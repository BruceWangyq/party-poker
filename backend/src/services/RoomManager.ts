import { 
  Room, 
  Player, 
  GameState, 
  GamePhase, 
  GameSettings,
  RoomCreateRequest,
  RoomJoinRequest
} from '../types';
import { 
  generateRoomId, 
  generateRoomCode, 
  generatePlayerId,
  isRoomExpired
} from '../utils/helpers';
import { logRoomEvent } from '../utils/logger';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private roomCodeMap: Map<string, string> = new Map(); // code -> roomId
  
  /**
   * Create a new room
   */
  createRoom(request: RoomCreateRequest): { room: Room; playerId: string } {
    const roomId = generateRoomId();
    const roomCode = this.generateUniqueRoomCode();
    const playerId = generatePlayerId();

    const defaultSettings: GameSettings = {
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 1000,
      maxPlayers: 8,
      minPlayers: 2,
      timeLimit: undefined
    };

    const settings: GameSettings = {
      ...defaultSettings,
      ...request.settings
    };

    // Create host player
    const hostPlayer: Player = {
      id: playerId,
      nickname: request.hostNickname,
      chips: settings.startingChips,
      holeCards: [],
      position: 0,
      isActive: true,
      isInHand: false,
      currentBet: 0,
      totalBet: 0,
      lastAction: null,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      hasFolded: false,
      isAllIn: false
    };

    const gameState: GameState = {
      phase: GamePhase.Waiting,
      communityCards: [],
      pot: 0,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      smallBlindIndex: 0,
      bigBlindIndex: 0,
      currentBet: 0,
      minRaise: settings.bigBlind,
      isHandActive: false,
      handNumber: 0,
      winners: [],
      players: [hostPlayer]
    };

    const room: Room = {
      id: roomId,
      code: roomCode,
      hostId: playerId,
      players: [hostPlayer],
      gameState,
      settings,
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.rooms.set(roomId, room);
    this.roomCodeMap.set(roomCode, roomId);

    logRoomEvent('Room Created', roomId, { code: roomCode, host: request.hostNickname });

    return { room, playerId };
  }

  /**
   * Join an existing room
   */
  joinRoom(request: RoomJoinRequest): { room: Room; playerId: string } {
    const roomId = this.roomCodeMap.get(request.roomCode);
    
    if (!roomId) {
      throw new Error('Room not found');
    }

    const room = this.rooms.get(roomId);
    
    if (!room) {
      throw new Error('Room not found');
    }

    if (!room.isActive) {
      throw new Error('Room is no longer active');
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room is full');
    }

    // Check if nickname is already taken
    const nicknameExists = room.players.some(p => 
      p.nickname.toLowerCase() === request.nickname.toLowerCase()
    );
    
    if (nicknameExists) {
      throw new Error('Nickname already taken');
    }

    const playerId = generatePlayerId();
    const newPlayer: Player = {
      id: playerId,
      nickname: request.nickname,
      chips: room.settings.startingChips,
      holeCards: [],
      position: room.players.length,
      isActive: true,
      isInHand: false,
      currentBet: 0,
      totalBet: 0,
      lastAction: null,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      hasFolded: false,
      isAllIn: false
    };

    room.players.push(newPlayer);
    room.gameState.players.push(newPlayer);
    room.lastActivity = new Date();

    logRoomEvent('Player Joined', roomId, { 
      playerId, 
      nickname: request.nickname,
      playerCount: room.players.length 
    });

    return { room, playerId };
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string, playerId: string): Room | null {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return null;
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
      return room;
    }

    const player = room.players[playerIndex];
    
    // If game is active and player is in hand, mark as inactive instead of removing
    if (room.gameState.isHandActive && player.isInHand) {
      player.isActive = false;
      player.isInHand = false;
      logRoomEvent('Player Disconnected', roomId, { playerId, nickname: player.nickname });
    } else {
      // Remove player completely if game is not active
      room.players.splice(playerIndex, 1);
      room.gameState.players.splice(playerIndex, 1);
      
      // Update positions for remaining players
      room.players.forEach((p, index) => {
        p.position = index;
      });
      room.gameState.players.forEach((p, index) => {
        p.position = index;
      });
      
      logRoomEvent('Player Left', roomId, { playerId, nickname: player.nickname });
    }

    room.lastActivity = new Date();

    // If host left, assign new host
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      logRoomEvent('Host Changed', roomId, { newHostId: room.hostId });
    }

    // If no players left, mark room as inactive
    if (room.players.length === 0) {
      this.closeRoom(roomId);
      return null;
    }

    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get room by code
   */
  getRoomByCode(code: string): Room | null {
    const roomId = this.roomCodeMap.get(code);
    return roomId ? this.rooms.get(roomId) || null : null;
  }

  /**
   * Update room activity timestamp
   */
  updateRoomActivity(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.lastActivity = new Date();
    }
  }

  /**
   * Close a room
   */
  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.isActive = false;
      this.roomCodeMap.delete(room.code);
      this.rooms.delete(roomId);
      
      logRoomEvent('Room Closed', roomId, { code: room.code });
    }
  }

  /**
   * Clean up expired rooms
   */
  cleanupExpiredRooms(expiryHours: number = 24): number {
    let cleanedCount = 0;
    
    for (const [roomId, room] of this.rooms.entries()) {
      if (isRoomExpired(room.lastActivity, expiryHours)) {
        this.closeRoom(roomId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logRoomEvent('Cleanup Completed', 'system', { cleanedRooms: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Get room statistics
   */
  getStats(): {
    totalRooms: number;
    activeRooms: number;
    totalPlayers: number;
    activePlayers: number;
  } {
    const activeRooms = Array.from(this.rooms.values()).filter(room => room.isActive);
    const totalPlayers = activeRooms.reduce((sum, room) => sum + room.players.length, 0);
    const activePlayers = activeRooms.reduce((sum, room) => 
      sum + room.players.filter(p => p.isActive).length, 0
    );

    return {
      totalRooms: this.rooms.size,
      activeRooms: activeRooms.length,
      totalPlayers,
      activePlayers
    };
  }

  /**
   * Get all active rooms (for admin purposes)
   */
  getAllActiveRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(room => room.isActive);
  }

  /**
   * Generate a unique room code
   */
  private generateUniqueRoomCode(): string {
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      const code = this.generateRandomCode();
      if (!this.roomCodeMap.has(code)) {
        return code;
      }
      attempts++;
    }
    
    throw new Error('Unable to generate unique room code');
  }

  /**
   * Generate a random 6-character code
   */
  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Find player in room
   */
  findPlayerInRoom(roomId: string, playerId: string): Player | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    return room.players.find(p => p.id === playerId) || null;
  }

  /**
   * Check if player is host
   */
  isPlayerHost(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? room.hostId === playerId : false;
  }

  /**
   * Get player count for room
   */
  getPlayerCount(roomId: string): number {
    const room = this.rooms.get(roomId);
    return room ? room.players.length : 0;
  }

  /**
   * Get active player count for room
   */
  getActivePlayerCount(roomId: string): number {
    const room = this.rooms.get(roomId);
    return room ? room.players.filter(p => p.isActive).length : 0;
  }

  /**
   * Update player's socket ID
   */
  updatePlayerSocket(roomId: string, playerId: string, socketId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      const player = room.players.find(p => p.id === playerId);
      if (player) {
        player.socketId = socketId;
        room.lastActivity = new Date();
      }
    }
  }

  /**
   * Remove socket ID from player (on disconnect)
   */
  removePlayerSocket(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      const player = room.players.find(p => p.id === playerId);
      if (player) {
        delete player.socketId;
      }
    }
  }
}