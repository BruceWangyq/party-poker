import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import Redis from 'redis';
import logger from '../utils/logger';

// Redis client setup
let redisClient: Redis.RedisClientType | null = null;

if (process.env.REDIS_URL) {
  try {
    redisClient = Redis.createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0')
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error', err);
      redisClient = null;
    });

    redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis', error);
    redisClient = null;
  }
}

// Rate limiter configurations
const rateLimiterConfig = {
  keyGenerator: (req: Request) => req.ip,
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000, // Convert to seconds
  blockDuration: 900, // 15 minutes
};

// Create rate limiters
const rateLimiter = redisClient 
  ? new RateLimiterRedis({
      ...rateLimiterConfig,
      storeClient: redisClient,
    })
  : new RateLimiterMemory(rateLimiterConfig);

// Strict rate limiter for sensitive operations
const strictRateLimiter = redisClient
  ? new RateLimiterRedis({
      ...rateLimiterConfig,
      storeClient: redisClient,
      points: 10, // Fewer requests
      duration: 60, // Per minute
      blockDuration: 600, // 10 minutes block
    })
  : new RateLimiterMemory({
      ...rateLimiterConfig,
      points: 10,
      duration: 60,
      blockDuration: 600,
    });

// Socket rate limiter
const socketRateLimiter = redisClient
  ? new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'socket_rl',
      points: 20, // Number of actions
      duration: 60, // Per minute
      blockDuration: 300, // 5 minutes block
    })
  : new RateLimiterMemory({
      keyPrefix: 'socket_rl',
      points: 20,
      duration: 60,
      blockDuration: 300,
    });

/**
 * Express middleware for rate limiting
 */
export const createRateLimitMiddleware = (limiter = rateLimiter) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      await limiter.consume(clientIp);
      next();
    } catch (rateLimiterRes: any) {
      const msBeforeNext = rateLimiterRes?.msBeforeNext || 60000;
      const remainingPoints = rateLimiterRes?.remainingPoints || 0;
      
      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000),
        'X-RateLimit-Limit': rateLimiterConfig.points,
        'X-RateLimit-Remaining': remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
      });

      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        msBeforeNext
      });

      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
        retryAfter: Math.round(msBeforeNext / 1000)
      });
    }
  };
};

/**
 * Standard rate limiting middleware
 */
export const rateLimitMiddleware = createRateLimitMiddleware(rateLimiter);

/**
 * Strict rate limiting middleware for sensitive operations
 */
export const strictRateLimitMiddleware = createRateLimitMiddleware(strictRateLimiter);

/**
 * Socket rate limiting
 */
export const checkSocketRateLimit = async (socketId: string): Promise<void> => {
  try {
    await socketRateLimiter.consume(socketId);
  } catch (rateLimiterRes: any) {
    const msBeforeNext = rateLimiterRes?.msBeforeNext || 60000;
    logger.warn('Socket rate limit exceeded', {
      socketId,
      msBeforeNext
    });
    throw new Error('Rate limit exceeded');
  }
};

/**
 * Rate limiter utility functions
 */
export const rateLimiterUtils = {
  /**
   * Check remaining points for an IP
   */
  async getRemainingPoints(ip: string): Promise<number> {
    try {
      const res = await rateLimiter.get(ip);
      return res ? res.remainingPoints : rateLimiterConfig.points;
    } catch (error) {
      logger.error('Error getting remaining points', error);
      return 0;
    }
  },

  /**
   * Reset rate limit for an IP
   */
  async resetLimit(ip: string): Promise<void> {
    try {
      await rateLimiter.delete(ip);
      logger.info('Rate limit reset', { ip });
    } catch (error) {
      logger.error('Error resetting rate limit', error);
    }
  },

  /**
   * Check if IP is blocked
   */
  async isBlocked(ip: string): Promise<boolean> {
    try {
      const res = await rateLimiter.get(ip);
      return res ? res.remainingPoints <= 0 : false;
    } catch (error) {
      logger.error('Error checking if IP is blocked', error);
      return false;
    }
  },

  /**
   * Socket rate limiting check
   */
  async checkSocket(socketId: string): Promise<void> {
    return checkSocketRateLimit(socketId);
  }
};

export { rateLimiterUtils as rateLimiter };
export default rateLimiterUtils;