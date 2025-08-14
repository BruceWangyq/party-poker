import { Router, Response } from 'express';
import { RoomManager } from '../services/RoomManager';
import { GameManager } from '../game/GameManager';
import { 
  authenticate, 
  optionalAuthenticate,
  AuthRequest 
} from '../middleware/auth';
import { rateLimitMiddleware, strictRateLimitMiddleware } from '../middleware/rateLimiter';
import { 
  validateRoomCreate, 
  validateRoomJoin,
  validateRoomSettings
} from '../utils/validation';
import { sanitizeInput, isValidRoomCode } from '../utils/helpers';
import logger from '../utils/logger';

const router = Router();
const roomManager = new RoomManager();
const gameManager = new GameManager();

/**
 * Create a new room
 * POST /rooms
 */
router.post('/', authenticate, strictRateLimitMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { nickname, settings } = req.body;
    
    // Use nickname from body or auth token
    const hostNickname = nickname || req.user?.nickname;
    
    if (!hostNickname) {
      return res.status(400).json({
        success: false,
        error: 'Nickname is required to create a room'
      });
    }

    const sanitizedNickname = sanitizeInput(hostNickname);
    const createRequest = {
      hostNickname: sanitizedNickname,
      settings: settings || {}
    };

    // Validate request
    const validation = validateRoomCreate(createRequest);
    if (validation.error) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Validate settings if provided
    if (settings) {
      const settingsValidation = validateRoomSettings(settings);
      if (!settingsValidation.valid) {
        return res.status(400).json({
          success: false,
          error: settingsValidation.error
        });
      }
    }

    const { room, playerId } = roomManager.createRoom(validation.value!);

    logger.info('Room created via API', {
      roomId: room.id,
      code: room.code,
      hostId: playerId,
      hostNickname: sanitizedNickname,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: {
        room: {
          id: room.id,
          code: room.code,
          hostId: room.hostId,
          players: room.players,
          settings: room.settings,
          gameState: room.gameState,
          isActive: room.isActive,
          createdAt: room.createdAt
        },
        playerId
      }
    });

  } catch (error) {
    logger.error('Failed to create room', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create room'
    });
  }
});

/**
 * Join a room
 * POST /rooms/:code/join
 */
router.post('/:code/join', authenticate, rateLimitMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const { nickname } = req.body;

    if (!isValidRoomCode(code)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid room code format'
      });
    }

    // Use nickname from body or auth token
    const playerNickname = nickname || req.user?.nickname;
    
    if (!playerNickname) {
      return res.status(400).json({
        success: false,
        error: 'Nickname is required to join a room'
      });
    }

    const sanitizedNickname = sanitizeInput(playerNickname);
    const joinRequest = {
      roomCode: code.toUpperCase(),
      nickname: sanitizedNickname
    };

    // Validate request
    const validation = validateRoomJoin(joinRequest);
    if (validation.error) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { room, playerId } = roomManager.joinRoom(validation.value!);

    logger.info('Player joined room via API', {
      roomId: room.id,
      code: room.code,
      playerId,
      nickname: sanitizedNickname,
      playerCount: room.players.length,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        room: {
          id: room.id,
          code: room.code,
          hostId: room.hostId,
          players: room.players,
          settings: room.settings,
          gameState: room.gameState,
          isActive: room.isActive,
          createdAt: room.createdAt
        },
        playerId
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to join room';
    
    logger.error('Failed to join room', {
      error: errorMessage,
      code: req.params.code,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * Get room information
 * GET /rooms/:code
 */
router.get('/:code', optionalAuthenticate, rateLimitMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;

    if (!isValidRoomCode(code)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid room code format'
      });
    }

    const room = roomManager.getRoomByCode(code.toUpperCase());

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    if (!room.isActive) {
      return res.status(410).json({
        success: false,
        error: 'Room is no longer active'
      });
    }

    // Return public room information
    res.json({
      success: true,
      data: {
        id: room.id,
        code: room.code,
        playerCount: room.players.length,
        maxPlayers: room.settings.maxPlayers,
        isGameActive: room.gameState.isHandActive,
        gamePhase: room.gameState.phase,
        canJoin: room.players.length < room.settings.maxPlayers && !room.gameState.isHandActive,
        createdAt: room.createdAt,
        settings: {
          smallBlind: room.settings.smallBlind,
          bigBlind: room.settings.bigBlind,
          startingChips: room.settings.startingChips,
          maxPlayers: room.settings.maxPlayers,
          minPlayers: room.settings.minPlayers
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get room info', {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: req.params.code,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get room information'
    });
  }
});

/**
 * Leave a room
 * POST /rooms/:roomId/leave
 */
router.post('/:roomId/leave', authenticate, rateLimitMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = roomManager.leaveRoom(roomId, userId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found or already left'
      });
    }

    logger.info('Player left room via API', {
      roomId,
      userId,
      remainingPlayers: room.players.length,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        message: 'Successfully left room',
        room: {
          id: room.id,
          code: room.code,
          playerCount: room.players.length
        }
      }
    });

  } catch (error) {
    logger.error('Failed to leave room', {
      error: error instanceof Error ? error.message : 'Unknown error',
      roomId: req.params.roomId,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to leave room'
    });
  }
});

/**
 * Get room statistics
 * GET /rooms/stats
 */
router.get('/stats', optionalAuthenticate, rateLimitMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const stats = roomManager.getStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get room stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

/**
 * Validate room code
 * POST /rooms/validate-code
 */
router.post('/validate-code', optionalAuthenticate, rateLimitMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Room code is required'
      });
    }

    const sanitizedCode = sanitizeInput(code.trim().toUpperCase());

    if (!isValidRoomCode(sanitizedCode)) {
      return res.json({
        success: true,
        data: {
          valid: false,
          error: 'Invalid room code format (must be 6 characters, letters and numbers only)'
        }
      });
    }

    const room = roomManager.getRoomByCode(sanitizedCode);

    if (!room) {
      return res.json({
        success: true,
        data: {
          valid: false,
          error: 'Room not found'
        }
      });
    }

    if (!room.isActive) {
      return res.json({
        success: true,
        data: {
          valid: false,
          error: 'Room is no longer active'
        }
      });
    }

    if (room.players.length >= room.settings.maxPlayers) {
      return res.json({
        success: true,
        data: {
          valid: false,
          error: 'Room is full'
        }
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        room: {
          code: room.code,
          playerCount: room.players.length,
          maxPlayers: room.settings.maxPlayers,
          isGameActive: room.gameState.isHandActive
        }
      }
    });

  } catch (error) {
    logger.error('Room code validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: req.body.code,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
});

export default router;