#!/usr/bin/env node

const { io } = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:3001';
const HOST_NICKNAME = 'Host1';
const JOINER_NICKNAME = 'Player2';

async function testRoomCreationAndJoin() {
  console.log('🎮 Testing Party Poker Room Creation and Join\n');

  // Create first client (host)
  const hostSocket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
  });

  let roomCode = null;

  return new Promise((resolve, reject) => {
    hostSocket.on('connect', () => {
      console.log('✅ Host connected:', hostSocket.id);
      
      // Create room
      hostSocket.emit('room:create', {
        hostNickname: HOST_NICKNAME,
        settings: {
          maxPlayers: 4,
          minPlayers: 2
        }
      });
    });

    hostSocket.on('room:created', (data) => {
      console.log('✅ Room created successfully!');
      console.log('   Room ID:', data.room.id);
      console.log('   Room Code:', data.room.code);
      console.log('   Host Player ID:', data.playerId);
      console.log('   Players:', data.room.players.length);
      
      roomCode = data.room.code;
      
      // Now try to join with second client
      setTimeout(() => testJoinRoom(roomCode, resolve, reject), 1000);
    });

    hostSocket.on('room:error', (error) => {
      console.log('❌ Host room error:', error);
      reject(error);
    });

    hostSocket.on('connect_error', (error) => {
      console.log('❌ Host connection error:', error.message);
      reject(error);
    });
  });
}

function testJoinRoom(roomCode, resolve, reject) {
  console.log('\n🔗 Testing room join...');
  
  const joinerSocket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
  });

  joinerSocket.on('connect', () => {
    console.log('✅ Joiner connected:', joinerSocket.id);
    
    // Try to join room
    joinerSocket.emit('room:join', {
      roomCode: roomCode,
      nickname: JOINER_NICKNAME
    });
  });

  joinerSocket.on('room:joined', (data) => {
    console.log('✅ Successfully joined room!');
    console.log('   Player ID:', data.playerId);
    console.log('   Total Players:', data.room.players.length);
    console.log('   Players:', data.room.players.map(p => p.nickname));
    
    // Clean up
    joinerSocket.disconnect();
    resolve('Success');
  });

  joinerSocket.on('room:error', (error) => {
    console.log('❌ Join room error:', error);
    
    // Debug information
    console.log('\n🔍 Debug Info:');
    console.log('   Room Code Used:', roomCode);
    console.log('   Nickname Used:', JOINER_NICKNAME);
    console.log('   Expected Format: 6 chars, A-Z0-9 only');
    console.log('   Nickname Format: 2-20 chars, a-zA-Z0-9_- only');
    
    joinerSocket.disconnect();
    reject(error);
  });

  joinerSocket.on('connect_error', (error) => {
    console.log('❌ Joiner connection error:', error.message);
    joinerSocket.disconnect();
    reject(error);
  });

  // Timeout for join attempt
  setTimeout(() => {
    console.log('⏰ Join attempt timed out');
    joinerSocket.disconnect();
    reject('Join timeout');
  }, 5000);
}

// Run the test
testRoomCreationAndJoin()
  .then((result) => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n💥 Test failed:', error);
    process.exit(1);
  });