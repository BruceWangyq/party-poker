#!/usr/bin/env node

const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

// Create two socket connections for two players
const hostSocket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const playerSocket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

let roomCode = null;
let hostPlayerId = null;
let playerPlayerId = null;

// Host socket event handlers
hostSocket.on('connect', () => {
  console.log('✅ Host connected to server');
  
  // Create a room
  console.log('🎮 Host creating room...');
  hostSocket.emit('room:create', {
    hostNickname: 'Host Player',
    settings: {
      maxPlayers: 8,
      minPlayers: 2,
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 1000
    }
  });
});

hostSocket.on('room:created', (data) => {
  console.log('✅ Room created successfully!');
  console.log('   Room Code:', data.room.code);
  console.log('   Host ID:', data.playerId);
  roomCode = data.room.code;
  hostPlayerId = data.playerId;
  
  // Connect second player after room is created
  setTimeout(() => {
    console.log('\n🔗 Second player connecting...');
    playerSocket.connect();
  }, 1000);
});

hostSocket.on('room:updated', (room) => {
  console.log('🔄 [HOST] Room updated:');
  console.log('   Players:', room.players.length);
  console.log('   Game Phase:', room.gameState.phase);
  console.log('   Is Hand Active:', room.gameState.isHandActive);
  
  // Start game when we have 2 players and game hasn't started yet
  if (room.players.length >= 2 && room.gameState.phase === 'waiting') {
    setTimeout(() => {
      console.log('\n🎲 Host starting game...');
      hostSocket.emit('game:start');
    }, 2000);
  }
});

hostSocket.on('game:event', (event) => {
  console.log('🎲 [HOST] Game event:', event.type);
  if (event.type === 'GameStarted') {
    console.log('   ✅ GAME STARTED SUCCESSFULLY!');
    console.log('   Hand Number:', event.data.handNumber);
  }
});

hostSocket.on('error', (error) => {
  console.error('❌ [HOST] Error:', error);
});

hostSocket.on('disconnect', () => {
  console.log('❌ Host disconnected from server');
});

// Player socket event handlers
playerSocket.on('connect', () => {
  console.log('✅ Player connected to server');
  
  if (roomCode) {
    console.log('🔗 Player joining room:', roomCode);
    playerSocket.emit('room:join', {
      roomCode: roomCode,
      nickname: 'Player Two'
    });
  }
});

playerSocket.on('room:joined', (data) => {
  console.log('✅ Player joined room successfully!');
  console.log('   Room Code:', data.room.code);
  console.log('   Player ID:', data.playerId);
  console.log('   Total Players:', data.room.players.length);
  playerPlayerId = data.playerId;
});

playerSocket.on('room:updated', (room) => {
  console.log('🔄 [PLAYER] Room updated:');
  console.log('   Players:', room.players.length);
  console.log('   Game Phase:', room.gameState.phase);
  console.log('   Is Hand Active:', room.gameState.isHandActive);
});

playerSocket.on('game:event', (event) => {
  console.log('🎲 [PLAYER] Game event:', event.type);
  if (event.type === 'GameStarted') {
    console.log('   ✅ Game started notification received!');
  }
});

playerSocket.on('error', (error) => {
  console.error('❌ [PLAYER] Error:', error);
});

playerSocket.on('disconnect', () => {
  console.log('❌ Player disconnected from server');
});

// Error handling
process.on('SIGINT', () => {
  console.log('\n\n👋 Closing connections...');
  hostSocket.disconnect();
  playerSocket.disconnect();
  process.exit(0);
});

// Start by connecting the host
console.log('🚀 Starting game flow test...\n');
hostSocket.connect();

// Auto-exit after 15 seconds
setTimeout(() => {
  console.log('\n\n✅ Test completed. Closing connections...');
  hostSocket.disconnect();
  playerSocket.disconnect();
  process.exit(0);
}, 15000);