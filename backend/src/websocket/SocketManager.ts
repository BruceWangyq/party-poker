import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { 
  SocketEvents, 
  RoomCreateRequest, 
  RoomJoinRequest, 
  PlayerActionRequest,
  GameEvent,
  GameEventType
} from '../types';
import { RoomManager } from '../services/RoomManager';
import { GameManager } from '../game/GameManager';
import { 
  validateRoomCreate, 
  validateRoomJoin, 
  validatePlayerAction,
  validateGameAction
} from '../utils/validation';
import { logWebSocketEvent, logError } from '../utils/logger';
import rateLimiterUtils from '../middleware/rateLimiter';

interface SocketData {
  playerId?: string;
  roomId?: string;
  nickname?: string;
}

export class SocketManager {
  private io: Server;
  private roomManager: RoomManager;
  private gameManager: GameManager;
  private playerSocketMap: Map<string, string> = new Map(); // playerId -> socketId
  private socketPlayerMap: Map<string, string> = new Map(); // socketId -> playerId

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['polling', 'websocket'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6,
      allowRequest: (req, callback) => {
        // Allow all requests in development
        if (process.env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        callback(null, true);
      }
    });

    this.roomManager = new RoomManager();
    this.gameManager = new GameManager();

    this.setupEventHandlers();
    this.setupCleanupTimer();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket<SocketEvents>) => {
      logWebSocketEvent('Client Connected', socket.id, {
        transport: socket.conn.transport.name,
        remoteAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Rate limiting middleware
      socket.use(async (packet, next) => {
        try {
          await rateLimiterUtils.checkSocket(socket.id);
          next();
        } catch (error) {
          next(new Error('Rate limit exceeded'));
        }
      });

      // Room creation
      socket.on('room:create', async (data: RoomCreateRequest) => {
        try {
          const validation = validateRoomCreate(data);
          if (validation.error) {
            socket.emit('room:error', validation.error);
            return;
          }

          const { room, playerId } = this.roomManager.createRoom(validation.value!);
          
          // Store socket data
          socket.data = { playerId, roomId: room.id, nickname: data.hostNickname };
          this.playerSocketMap.set(playerId, socket.id);
          this.socketPlayerMap.set(socket.id, playerId);
          
          // Join socket room
          await socket.join(room.id);
          
          // Update player socket ID in room
          this.roomManager.updatePlayerSocket(room.id, playerId, socket.id);


          socket.emit('room:created', { room, playerId });
          
          logWebSocketEvent('Room Created', socket.id, { 
            roomId: room.id, 
            code: room.code,
            playerId 
          });

        } catch (error) {
          logError(error as Error, { socketId: socket.id, event: 'room:create' });
          socket.emit('room:error', 'Failed to create room');
        }
      });

      // Room joining
      socket.on('room:join', async (data: RoomJoinRequest) => {
        try {
          const validation = validateRoomJoin(data);
          if (validation.error) {
            socket.emit('room:error', validation.error);
            return;
          }

          const { room, playerId } = this.roomManager.joinRoom(validation.value!);
          
          // Store socket data
          socket.data = { playerId, roomId: room.id, nickname: data.nickname };
          this.playerSocketMap.set(playerId, socket.id);
          this.socketPlayerMap.set(socket.id, playerId);
          
          // Join socket room
          await socket.join(room.id);
          
          // Update player socket ID in room
          this.roomManager.updatePlayerSocket(room.id, playerId, socket.id);

          // Notify player
          socket.emit('room:joined', { room, playerId });
          
          // Notify all players in room (including existing ones)
          this.io.in(room.id).emit('room:updated', room);
          this.io.in(room.id).emit('game:event', {
            type: GameEventType.PlayerJoined,
            data: { playerId, nickname: data.nickname },
            timestamp: new Date()
          });

          logWebSocketEvent('Room Joined', socket.id, { 
            roomId: room.id, 
            playerId,
            nickname: data.nickname
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to join room';
          socket.emit('room:error', errorMessage);
          logError(error as Error, { socketId: socket.id, event: 'room:join' });
        }
      });

      // Room leaving
      socket.on('room:leave', () => {
        this.handlePlayerLeave(socket);
      });

      // Game start
      socket.on('game:start', () => {
        try {
          const { roomId, playerId } = socket.data as SocketData;
          
          if (!roomId || !playerId) {
            socket.emit('error', 'Invalid session data');
            return;
          }

          const room = this.roomManager.getRoom(roomId);
          if (!room) {
            socket.emit('error', 'Room not found');
            return;
          }

          // Check if player is host
          if (room.hostId !== playerId) {
            socket.emit('error', 'Only host can start the game');
            return;
          }

          // Check if enough players
          if (!this.gameManager.canStartGame(room)) {
            socket.emit('error', `Need at least ${room.settings.minPlayers} players to start`);
            return;
          }

          // Initialize and start game
          this.gameManager.initializeGame(room);
          const events = this.gameManager.startNewHand(room);

          // Broadcast game start to all players
          this.io.in(roomId).emit('room:updated', room);
          this.io.in(roomId).emit('game:event', {
            type: GameEventType.GameStarted,
            data: { handNumber: room.gameState.handNumber },
            timestamp: new Date()
          });

          // Broadcast all hand start events
          events.forEach(event => {
            this.io.in(roomId).emit('game:event', event);
          });

          // Notify current player
          if (room.players[room.gameState.currentPlayerIndex]) {
            const currentPlayerId = room.players[room.gameState.currentPlayerIndex].id;
            const currentPlayerSocket = this.playerSocketMap.get(currentPlayerId);
            if (currentPlayerSocket) {
              this.io.to(currentPlayerSocket).emit('player:turn', currentPlayerId);
            }
          }

          logWebSocketEvent('Game Started', socket.id, { roomId, playerId });

        } catch (error) {
          logError(error as Error, { socketId: socket.id, event: 'game:start' });
          socket.emit('error', 'Failed to start game');
        }
      });

      // Player action
      socket.on('game:action', (data: PlayerActionRequest) => {
        try {
          const { roomId, playerId } = socket.data as SocketData;
          
          if (!roomId || !playerId) {
            socket.emit('error', 'Invalid session data');
            return;
          }

          const room = this.roomManager.getRoom(roomId);
          if (!room) {
            socket.emit('error', 'Room not found');
            return;
          }

          // Validate action data
          const validation = validatePlayerAction(data);
          if (validation.error) {
            socket.emit('error', validation.error);
            return;
          }

          // Ensure it's the player's turn
          const currentPlayer = room.players[room.gameState.currentPlayerIndex];
          if (!currentPlayer || currentPlayer.id !== playerId) {
            socket.emit('error', 'Not your turn');
            return;
          }

          // Validate game action
          const gameValidation = validateGameAction(
            data,
            playerId,
            room.gameState.currentBet,
            currentPlayer.chips,
            currentPlayer.currentBet
          );

          if (!gameValidation.valid) {
            socket.emit('error', gameValidation.error || 'Invalid action');
            return;
          }

          // Process action
          const events = this.gameManager.processPlayerAction(room, data);

          // Broadcast updates to all players
          this.io.in(roomId).emit('room:updated', room);
          
          events.forEach(event => {
            this.io.in(roomId).emit('game:event', event);
          });

          // Notify next player if game is still active
          if (room.gameState.isHandActive && room.gameState.phase !== 'showdown') {
            const nextPlayer = room.players[room.gameState.currentPlayerIndex];
            if (nextPlayer) {
              const nextPlayerSocket = this.playerSocketMap.get(nextPlayer.id);
              if (nextPlayerSocket) {
                this.io.to(nextPlayerSocket).emit('player:turn', nextPlayer.id);
              }
            }
          }

          logWebSocketEvent('Player Action', socket.id, { 
            roomId, 
            playerId, 
            action: data.action,
            amount: data.amount
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Invalid action';
          socket.emit('error', errorMessage);
          logError(error as Error, { socketId: socket.id, event: 'game:action' });
        }
      });

      // Ping/Pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logWebSocketEvent('Client Disconnected', socket.id, { reason });
        this.handlePlayerLeave(socket, false);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        logError(error, { socketId: socket.id, event: 'socket_error' });
      });
    });
  }

  /**
   * Handle player leaving room
   */
  private handlePlayerLeave(socket: Socket, explicit: boolean = true): void {
    try {
      const { roomId, playerId, nickname } = socket.data as SocketData;
      
      if (!roomId || !playerId) {
        return;
      }

      // Remove from maps
      this.playerSocketMap.delete(playerId);
      this.socketPlayerMap.delete(socket.id);

      // Leave socket room
      socket.leave(roomId);

      // Handle room leave
      const room = this.roomManager.leaveRoom(roomId, playerId);
      
      if (room) {
        // Remove socket ID from player
        this.roomManager.removePlayerSocket(roomId, playerId);

        // Notify remaining players
        this.io.to(roomId).emit('room:updated', room);
        this.io.to(roomId).emit('game:event', {
          type: GameEventType.PlayerLeft,
          data: { playerId, nickname },
          timestamp: new Date()
        });

        logWebSocketEvent(explicit ? 'Player Left' : 'Player Disconnected', socket.id, {
          roomId,
          playerId,
          nickname
        });
      }

    } catch (error) {
      logError(error as Error, { socketId: socket.id, event: 'player_leave' });
    }
  }

  /**
   * Setup cleanup timer for expired rooms
   */
  private setupCleanupTimer(): void {
    // Clean up expired rooms every hour
    setInterval(() => {
      try {
        const cleanedCount = this.roomManager.cleanupExpiredRooms();
        if (cleanedCount > 0) {
          logWebSocketEvent('Room Cleanup', 'system', { cleanedRooms: cleanedCount });
        }
      } catch (error) {
        logError(error as Error, { event: 'room_cleanup' });
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Get server statistics
   */
  getStats() {
    const roomStats = this.roomManager.getStats();
    const socketStats = {
      connectedSockets: this.io.sockets.sockets.size,
      playerSockets: this.playerSocketMap.size
    };

    return {
      ...roomStats,
      ...socketStats
    };
  }

  /**
   * Broadcast message to specific room
   */
  broadcastToRoom(roomId: string, event: string, data: any): void {
    this.io.to(roomId).emit(event, data);
  }

  /**
   * Send message to specific player
   */
  sendToPlayer(playerId: string, event: string, data: any): boolean {
    const socketId = this.playerSocketMap.get(playerId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Get connected socket count
   */
  getConnectedSocketCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Gracefully shutdown the socket server
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        logWebSocketEvent('Socket Server Shutdown', 'system');
        resolve();
      });
    });
  }
}