//
//  RoomManager.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import Foundation
import Combine

class RoomManager: ObservableObject {
    @Published var currentRoom: Room?
    @Published var availableRooms: [Room] = []
    @Published var isConnected = false
    @Published var connectionError: String?
    @Published var currentPlayerId: String?
    
    private var networkService = NetworkService()
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        setupNetworkSubscriptions()
    }
    
    private func setupNetworkSubscriptions() {
        // Bind network service connection state
        networkService.$isConnected
            .assign(to: \.isConnected, on: self)
            .store(in: &cancellables)
        
        networkService.$connectionError
            .assign(to: \.connectionError, on: self)
            .store(in: &cancellables)
        
        // Handle room creation responses
        networkService.roomCreated
            .sink { [weak self] response in
                print("✅ Room created successfully!")
                print("   Room Code: \(response.room.code)")
                print("   Player ID: \(response.playerId)")
                
                self?.currentRoom = response.room
                self?.currentPlayerId = response.playerId
            }
            .store(in: &cancellables)
        
        // Handle room join responses
        networkService.roomJoined
            .sink { [weak self] response in
                print("✅ Successfully joined room!")
                print("   Room Code: \(response.room.code)")
                print("   Player ID: \(response.playerId)")
                print("   Total Players: \(response.room.players.count)")
                
                self?.currentRoom = response.room
                self?.currentPlayerId = response.playerId
            }
            .store(in: &cancellables)
        
        // Handle room updates
        networkService.roomUpdated
            .sink { [weak self] room in
                print("🔄 Room updated - Players: \(room.players.count)")
                print("   Game Phase: \(room.gameState.phase)")
                print("   Room Status: \(room.status)")
                print("   Is Hand Active: \(room.gameState.isHandActive)")
                self?.currentRoom = room
            }
            .store(in: &cancellables)
        
        // Handle room errors
        networkService.roomError
            .sink { [weak self] error in
                print("❌ Room error: \(error)")
                self?.connectionError = error
            }
            .store(in: &cancellables)
        
        // Handle game events
        networkService.gameEvent
            .sink { [weak self] event in
                print("🎲 Game event: \(event.type)")
                print("   Event data: \(event.data)")
                
                // Handle specific game events that should trigger UI updates
                if event.type == "GameStarted" {
                    print("🚀 Game has started! Updating room status...")
                    // The room update should come through room:updated event
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Public Interface
    
    func connect() {
        print("🌐 Connecting to backend server...")
        networkService.connect()
    }
    
    func disconnect() {
        networkService.disconnect()
        currentRoom = nil
        currentPlayerId = nil
    }
    
    func createRoom(hostName: String, settings: RoomSettings = RoomSettings()) {
        guard isConnected else {
            connectionError = "Not connected to server"
            return
        }
        
        print("🎮 Creating room with host: \(hostName)")
        networkService.createRoom(hostNickname: hostName, settings: settings)
    }
    
    func joinRoom(code: String, playerName: String) {
        guard isConnected else {
            connectionError = "Not connected to server"
            return
        }
        
        print("🔗 Joining room \(code) as \(playerName)")
        networkService.joinRoom(code: code, nickname: playerName)
    }
    
    func leaveRoom() {
        guard isConnected else { return }
        
        networkService.leaveRoom()
        currentRoom = nil
        currentPlayerId = nil
    }
    
    func startGame() {
        guard isConnected, currentRoom != nil else {
            connectionError = "Cannot start game - not connected or not in room"
            return
        }
        
        networkService.startGame()
    }
    
    // MARK: - Utility
    
    var canStartGame: Bool {
        guard let room = currentRoom else { return false }
        return room.players.count >= room.settings.minPlayers && 
               room.gameState.phase == .waiting &&
               room.hostId == currentPlayerId
    }
    
    var isHost: Bool {
        guard let room = currentRoom, let playerId = currentPlayerId else { return false }
        return room.hostId == playerId
    }
}