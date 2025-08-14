import { Router, Request, Response } from 'express';
import { 
  createGuestSession,
  sessionUtils,
  tokenUtils,
  authenticate,
  AuthRequest
} from '../middleware/auth';
import { rateLimitMiddleware, strictRateLimitMiddleware } from '../middleware/rateLimiter';
import { validateRoomJoin } from '../utils/validation';
import { sanitizeInput } from '../utils/helpers';
import logger from '../utils/logger';

const router = Router();

/**
 * Create guest session
 * POST /auth/guest
 */
router.post('/guest', rateLimitMiddleware, (req: Request, res: Response) => {
  try {
    const { nickname } = req.body;
    let sanitizedNickname: string | undefined;

    if (nickname) {
      sanitizedNickname = sanitizeInput(nickname.trim());
      
      // Validate nickname format
      if (sanitizedNickname.length < 2 || sanitizedNickname.length > 20) {
        return res.status(400).json({
          success: false,
          error: 'Nickname must be between 2 and 20 characters'
        });
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedNickname)) {
        return res.status(400).json({
          success: false,
          error: 'Nickname can only contain letters, numbers, underscores, and hyphens'
        });
      }
    }

    const session = sanitizedNickname 
      ? sessionUtils.createNamedGuest(sanitizedNickname)
      : sessionUtils.createAnonymousGuest();

    logger.info('Guest session created', {
      userId: session.user.id,
      nickname: session.user.nickname,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        user: session.user,
        token: session.token,
        expiresAt: tokenUtils.getExpiryTime(session.token)
      }
    });

  } catch (error) {
    logger.error('Failed to create guest session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
});

/**
 * Refresh session token
 * POST /auth/refresh
 */
router.post('/refresh', strictRateLimitMiddleware, (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = tokenUtils.extractFromHeader(authHeader);

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token required for refresh'
      });
    }

    const refreshedSession = sessionUtils.refreshGuestSession(token);

    if (!refreshedSession) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    logger.info('Session refreshed', {
      userId: refreshedSession.user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        user: refreshedSession.user,
        token: refreshedSession.token,
        expiresAt: tokenUtils.getExpiryTime(refreshedSession.token)
      }
    });

  } catch (error) {
    logger.error('Failed to refresh session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to refresh session'
    });
  }
});

/**
 * Verify session token
 * GET /auth/verify
 */
router.get('/verify', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = tokenUtils.extractFromHeader(authHeader);

    res.json({
      success: true,
      data: {
        user: req.user,
        valid: true,
        expiresAt: token ? tokenUtils.getExpiryTime(token) : null
      }
    });

  } catch (error) {
    logger.error('Token verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
});

/**
 * Get session info
 * GET /auth/me
 */
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = tokenUtils.extractFromHeader(authHeader);
    const expiresAt = token ? tokenUtils.getExpiryTime(token) : null;
    const isExpiringSoon = expiresAt ? (expiresAt.getTime() - Date.now()) < 24 * 60 * 60 * 1000 : false;

    res.json({
      success: true,
      data: {
        user: req.user,
        expiresAt,
        isExpiringSoon,
        sessionType: req.user?.isGuest ? 'guest' : 'registered'
      }
    });

  } catch (error) {
    logger.error('Failed to get session info', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get session info'
    });
  }
});

/**
 * Validate nickname availability
 * POST /auth/validate-nickname
 */
router.post('/validate-nickname', rateLimitMiddleware, (req: Request, res: Response) => {
  try {
    const { nickname } = req.body;

    if (!nickname) {
      return res.status(400).json({
        success: false,
        error: 'Nickname is required'
      });
    }

    const sanitized = sanitizeInput(nickname.trim());
    
    // Validate nickname format
    const validation = validateRoomJoin({ roomCode: 'DUMMY', nickname: sanitized });
    
    if (validation.error) {
      return res.json({
        success: true,
        data: {
          valid: false,
          error: validation.error
        }
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        sanitized
      }
    });

  } catch (error) {
    logger.error('Nickname validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
});

/**
 * Health check for auth service
 * GET /auth/health
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: 'auth',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

export default router;