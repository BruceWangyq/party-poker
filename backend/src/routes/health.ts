import { Router, Request, Response } from 'express';
import { rateLimitMiddleware } from '../middleware/rateLimiter';
import logger from '../utils/logger';

const router = Router();

/**
 * Basic health check
 * GET /health
 */
router.get('/', rateLimitMiddleware, (req: Request, res: Response) => {
  try {
    const healthInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      success: true,
      data: healthInfo
    });

  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

/**
 * Detailed health check with dependencies
 * GET /health/detailed
 */
router.get('/detailed', rateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check Redis connection (if configured)
    let redisStatus = 'not_configured';
    if (process.env.REDIS_URL) {
      try {
        // Basic Redis ping would go here
        redisStatus = 'healthy';
      } catch (error) {
        redisStatus = 'unhealthy';
      }
    }

    const healthInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      dependencies: {
        redis: redisStatus,
        websocket: 'healthy'
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        pid: process.pid
      }
    };

    // Determine overall status
    const hasUnhealthyDependencies = Object.values(healthInfo.dependencies)
      .some(status => status === 'unhealthy');
    
    if (hasUnhealthyDependencies) {
      healthInfo.status = 'degraded';
    }

    const statusCode = healthInfo.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: healthInfo.status !== 'unhealthy',
      data: healthInfo
    });

  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }
    });
  }
});

/**
 * Readiness probe (for Kubernetes)
 * GET /health/ready
 */
router.get('/ready', (req: Request, res: Response) => {
  // Check if the application is ready to receive traffic
  // This could include database connections, external services, etc.
  
  const isReady = true; // Add actual readiness checks here
  
  if (isReady) {
    res.json({
      success: true,
      data: {
        status: 'ready',
        timestamp: new Date().toISOString()
      }
    });
  } else {
    res.status(503).json({
      success: false,
      data: {
        status: 'not_ready',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Liveness probe (for Kubernetes)
 * GET /health/live
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if this endpoint responds, the app is alive
  res.json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

/**
 * Startup probe (for Kubernetes)
 * GET /health/startup
 */
router.get('/startup', (req: Request, res: Response) => {
  // Check if the application has finished starting up
  const hasStartedUp = true; // Add actual startup checks here
  
  if (hasStartedUp) {
    res.json({
      success: true,
      data: {
        status: 'started',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
  } else {
    res.status(503).json({
      success: false,
      data: {
        status: 'starting',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;