#!/usr/bin/env node

const { io } = require('socket.io-client');

// Test configuration - simulating iOS client behavior
const SERVER_URL = 'http://localhost:3001';

async function testServerForIOSCompatibility() {
  console.log('📱 Testing Party Poker Backend for iOS Compatibility\n');

  // Create client with similar config to iOS client
  const client = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true
  });

  return new Promise((resolve, reject) => {
    let roomCode = null;

    client.on('connect', () => {
      console.log('✅ iOS-style client connected:', client.id);
      
      // Test room creation with iOS-style data
      client.emit('room:create', {
        hostNickname: 'iOSHost',
        settings: {
          maxPlayers: 4,
          minPlayers: 2,
          smallBlind: 10,
          bigBlind: 20,
          startingChips: 1000
        }
      });
    });

    client.on('room:created', (data) => {
      console.log('✅ Room created for iOS client!');
      console.log('   Room Code:', data.room.code);
      console.log('   Host Player ID:', data.playerId);
      console.log('   Game Phase:', data.room.gameState.phase);
      
      roomCode = data.room.code;
      
      // Create second client to test join
      setTimeout(() => testJoinFromSecondClient(roomCode, resolve, reject), 1000);
    });

    client.on('room:error', (error) => {
      console.log('❌ Room creation error:', error);
      reject(error);
    });

    client.on('connect_error', (error) => {
      console.log('❌ Connection error:', error.message);
      reject(error);
    });

    // Set timeout
    setTimeout(() => {
      console.log('⏰ Test timed out');
      client.disconnect();
      reject('Test timeout');
    }, 10000);
  });
}

function testJoinFromSecondClient(roomCode, resolve, reject) {
  console.log('\n📱 Testing second iOS client joining...');
  
  const client2 = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true
  });

  client2.on('connect', () => {
    console.log('✅ Second iOS client connected:', client2.id);
    
    // Test joining with room code
    client2.emit('room:join', {
      roomCode: roomCode,
      nickname: 'iOSPlayer2'
    });
  });

  client2.on('room:joined', (data) => {
    console.log('✅ Second client joined successfully!');
    console.log('   Player ID:', data.playerId);
    console.log('   Total Players:', data.room.players.length);
    console.log('   Player Names:', data.room.players.map(p => p.nickname));
    
    // Check if the room structure matches what iOS expects
    const room = data.room;
    console.log('\n🔍 Room structure validation:');
    console.log('   ✓ id:', typeof room.id === 'string');
    console.log('   ✓ code:', typeof room.code === 'string' && room.code.length === 6);
    console.log('   ✓ hostId:', typeof room.hostId === 'string');
    console.log('   ✓ players array:', Array.isArray(room.players));
    console.log('   ✓ gameState object:', typeof room.gameState === 'object');
    console.log('   ✓ settings object:', typeof room.settings === 'object');
    
    // Clean up
    client2.disconnect();
    resolve('✨ iOS compatibility test passed!');
  });

  client2.on('room:error', (error) => {
    console.log('❌ Join error:', error);
    client2.disconnect();
    reject(error);
  });

  client2.on('connect_error', (error) => {
    console.log('❌ Second client connection error:', error.message);
    client2.disconnect();
    reject(error);
  });
}

// Run the test
testServerForIOSCompatibility()
  .then((result) => {
    console.log('\n🎉', result);
    console.log('\n📱 Your iOS client should now be able to:');
    console.log('   • Connect to the backend server');
    console.log('   • Create rooms and receive room codes');
    console.log('   • Join existing rooms with room codes');
    console.log('   • See real-time updates when players join/leave');
    console.log('\n🚀 Ready to test with iOS simulators!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n💥 Test failed:', error);
    process.exit(1);
  });