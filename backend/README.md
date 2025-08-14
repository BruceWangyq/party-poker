# Party Poker Backend

A real-time multiplayer poker backend server built with Node.js, Express, TypeScript, and Socket.IO.

## Features

- **Real-time Multiplayer**: WebSocket-based real-time gameplay
- **Texas Hold'em Poker**: Complete poker game logic and hand evaluation
- **Room Management**: Create and join poker rooms with unique codes
- **Player Management**: Guest authentication and session management
- **Game State Synchronization**: Automatic game state updates across all players
- **Rate Limiting**: Protection against abuse and spam
- **Comprehensive Logging**: Structured logging for monitoring and debugging
- **Input Validation**: Robust validation and sanitization
- **Error Handling**: Graceful error handling and recovery

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Real-time**: Socket.IO
- **Caching**: Redis (optional)
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- Redis (optional, for production rate limiting)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd party-poker/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `JWT_SECRET` | JWT signing secret | `fallback-secret` |
| `REDIS_URL` | Redis connection URL | - |
| `REDIS_PASSWORD` | Redis password | - |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `900000` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3000` |

## API Endpoints

### Authentication
- `POST /api/auth/guest` - Create guest session
- `POST /api/auth/refresh` - Refresh session token
- `GET /api/auth/verify` - Verify session token
- `GET /api/auth/me` - Get session info

### Rooms
- `POST /api/rooms` - Create a new room
- `POST /api/rooms/:code/join` - Join a room by code
- `GET /api/rooms/:code` - Get room information
- `POST /api/rooms/:roomId/leave` - Leave a room
- `GET /api/rooms/stats` - Get room statistics
- `POST /api/rooms/validate-code` - Validate room code

### Health
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health with dependencies
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe

## WebSocket Events

### Client to Server
- `room:create` - Create a new room
- `room:join` - Join an existing room
- `room:leave` - Leave current room
- `game:start` - Start the game (host only)
- `game:action` - Perform game action (fold, call, raise, etc.)
- `ping` - Connection health check

### Server to Client
- `room:created` - Room creation confirmation
- `room:joined` - Room join confirmation
- `room:updated` - Room state update
- `room:error` - Room operation error
- `game:updated` - Game state update
- `game:event` - Game event notification
- `player:turn` - Player's turn notification
- `error` - General error
- `pong` - Ping response

## Game Flow

### Room Creation and Joining
1. Player creates guest session via `/api/auth/guest`
2. Player creates room via WebSocket `room:create` event
3. Other players join using the 6-character room code
4. Host starts the game when ready

### Gameplay
1. **Pre-flop**: Players receive 2 hole cards, betting round
2. **Flop**: 3 community cards dealt, betting round
3. **Turn**: 1 community card dealt, betting round
4. **River**: Final community card dealt, betting round
5. **Showdown**: Best hands determined, pot awarded

### Player Actions
- **Fold**: Forfeit hand
- **Check**: Pass action (when no bet to call)
- **Call**: Match current bet
- **Raise**: Increase the bet
- **All-in**: Bet all remaining chips

## Architecture

```
├── src/
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions and helpers
│   ├── middleware/     # Express middleware
│   ├── routes/         # HTTP route handlers
│   ├── services/       # Business logic services
│   ├── game/           # Poker game engine
│   ├── websocket/      # WebSocket event handlers
│   └── server.ts       # Main server entry point
```

### Key Components

- **PokerEngine**: Core poker logic and hand evaluation
- **GameManager**: Game state management and action processing
- **RoomManager**: Room creation, joining, and lifecycle management
- **SocketManager**: WebSocket connection and event handling
- **Authentication**: JWT-based guest session management

## Development

### Scripts
```bash
npm run dev        # Start development server with hot reload
npm run build      # Build TypeScript to JavaScript
npm run start      # Start production server
npm run test       # Run tests
npm run lint       # Lint TypeScript files
npm run format     # Format code with Prettier
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Production Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Considerations
- Set `NODE_ENV=production`
- Use a strong `JWT_SECRET`
- Configure Redis for rate limiting
- Set up proper logging aggregation
- Configure load balancing for multiple instances

## Performance

### Optimizations
- Redis-based rate limiting and caching
- Connection pooling for WebSocket
- Efficient game state synchronization
- Memory-efficient data structures
- Graceful error handling and recovery

### Monitoring
- Structured logging with Winston
- Health check endpoints for orchestration
- Real-time metrics collection
- Error tracking and alerting

## Security

### Measures
- Input validation and sanitization
- Rate limiting on all endpoints
- CORS configuration
- Helmet security headers
- JWT token expiration
- WebSocket connection limits

### Best Practices
- Regular dependency updates
- Security audit with `npm audit`
- Environment variable protection
- Graceful error handling without information leakage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and linting
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information
4. Include logs and reproduction steps