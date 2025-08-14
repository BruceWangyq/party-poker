import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generatePlayerId } from '../utils/helpers';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    nickname?: string;
    isGuest: boolean;
  };
}

interface TokenPayload {
  id: string;
  nickname?: string;
  isGuest: boolean;
  iat?: number;
  exp?: number;
}

/**
 * JWT secret key
 */
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate JWT token
 */
export const generateToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

/**
 * Create guest session
 */
export const createGuestSession = (nickname?: string) => {
  const id = generatePlayerId();
  const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
    id,
    nickname,
    isGuest: true
  };
  
  const token = generateToken(payload);
  
  return {
    user: payload,
    token
  };
};

/**
 * Authentication middleware for Express routes
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    
    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

/**
 * Optional authentication middleware (for public endpoints that can benefit from user context)
 */
export const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

/**
 * Password hashing utilities
 */
export const passwordUtils = {
  /**
   * Hash a password
   */
  async hash(password: string): Promise<string> {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    return bcrypt.hash(password, rounds);
  },

  /**
   * Compare password with hash
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
};

/**
 * Token utilities
 */
export const tokenUtils = {
  /**
   * Extract token from Authorization header
   */
  extractFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    
    return parts[1];
  },

  /**
   * Decode token without verification (for debugging)
   */
  decode(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  },

  /**
   * Check if token is expired
   */
  isExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return true;
      
      return Date.now() >= decoded.exp * 1000;
    } catch (error) {
      return true;
    }
  },

  /**
   * Get token expiry time
   */
  getExpiryTime(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return null;
      
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }
};

/**
 * Session utilities for guest users
 */
export const sessionUtils = {
  /**
   * Create anonymous guest session
   */
  createAnonymousGuest(): { user: TokenPayload; token: string } {
    return createGuestSession();
  },

  /**
   * Create named guest session
   */
  createNamedGuest(nickname: string): { user: TokenPayload; token: string } {
    return createGuestSession(nickname);
  },

  /**
   * Refresh guest session (extend expiry)
   */
  refreshGuestSession(currentToken: string): { user: TokenPayload; token: string } | null {
    try {
      const decoded = verifyToken(currentToken);
      if (!decoded.isGuest) return null;

      // Create new token with same data but fresh expiry
      const newToken = generateToken({
        id: decoded.id,
        nickname: decoded.nickname,
        isGuest: decoded.isGuest
      });

      return {
        user: decoded,
        token: newToken
      };
    } catch (error) {
      return null;
    }
  }
};

/**
 * Authorization helpers
 */
export const authUtils = {
  /**
   * Check if user is authenticated
   */
  isAuthenticated(req: AuthRequest): boolean {
    return !!req.user;
  },

  /**
   * Check if user is guest
   */
  isGuest(req: AuthRequest): boolean {
    return !!req.user?.isGuest;
  },

  /**
   * Get user ID from request
   */
  getUserId(req: AuthRequest): string | null {
    return req.user?.id || null;
  },

  /**
   * Get user nickname from request
   */
  getNickname(req: AuthRequest): string | null {
    return req.user?.nickname || null;
  }
};

export { AuthRequest };