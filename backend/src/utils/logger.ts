import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'party-poker-backend' },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Helper functions
export const logGameEvent = (event: string, data: any, roomId?: string) => {
  logger.info('Game Event', {
    event,
    roomId,
    data,
    category: 'game'
  });
};

export const logPlayerAction = (playerId: string, action: string, roomId: string, data?: any) => {
  logger.info('Player Action', {
    playerId,
    action,
    roomId,
    data,
    category: 'player'
  });
};

export const logRoomEvent = (event: string, roomId: string, data?: any) => {
  logger.info('Room Event', {
    event,
    roomId,
    data,
    category: 'room'
  });
};

export const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    context,
    category: 'error'
  });
};

export const logWebSocketEvent = (event: string, socketId: string, data?: any) => {
  logger.debug('WebSocket Event', {
    event,
    socketId,
    data,
    category: 'websocket'
  });
};

export default logger;