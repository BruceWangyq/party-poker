//
//  Room.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import Foundation

struct RoomSettings: Codable {
    var maxPlayers: Int = 8
    var minPlayers: Int = 2
    var smallBlind: Int = 10
    var bigBlind: Int = 20
    var startingChips: Int = 1000
    var timeLimit: Int? = nil
}

enum RoomStatus: String, Codable {
    case waiting = "waiting"
    case playing = "playing"
    case finished = "finished"
}

class Room: ObservableObject, Identifiable, Codable {
    @Published var id: String
    @Published var code: String
    @Published var hostId: String
    @Published var players: [Player] = []
    @Published var gameState: GameState {
        didSet {
            // Update status whenever gameState changes
            updateStatus()
        }
    }
    @Published var settings: RoomSettings
    @Published var isActive: Bool = true
    @Published var createdAt: Date = Date()
    @Published var lastActivity: Date = Date()
    @Published var status: RoomStatus = .waiting
    
    private func updateStatus() {
        if gameState.phase == .waiting {
            status = .waiting
        } else if gameState.phase == .handComplete {
            status = .finished
        } else {
            status = .playing
        }
    }
    
    // Coding keys to match backend structure
    private enum CodingKeys: String, CodingKey {
        case id, code, hostId, players, gameState, settings, isActive, createdAt, lastActivity
    }
    
    init(hostId: String, settings: RoomSettings = RoomSettings()) {
        self.id = UUID().uuidString
        self.code = Room.generateRoomCode()
        self.hostId = hostId
        self.settings = settings
        self.gameState = GameState()
        self.status = .waiting
    }
    
    // MARK: - Codable implementation
    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        code = try container.decode(String.self, forKey: .code)
        hostId = try container.decode(String.self, forKey: .hostId)
        players = try container.decode([Player].self, forKey: .players)
        gameState = try container.decode(GameState.self, forKey: .gameState)
        settings = try container.decode(RoomSettings.self, forKey: .settings)
        isActive = try container.decode(Bool.self, forKey: .isActive)
        
        // Handle date decoding with ISO8601 format
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let createdAtString = try? container.decode(String.self, forKey: .createdAt) {
            createdAt = dateFormatter.date(from: createdAtString) ?? Date()
        } else {
            createdAt = Date()
        }
        
        if let lastActivityString = try? container.decode(String.self, forKey: .lastActivity) {
            lastActivity = dateFormatter.date(from: lastActivityString) ?? Date()
        } else {
            lastActivity = Date()
        }
        
        // Update status based on decoded gameState
        updateStatus()
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(id, forKey: .id)
        try container.encode(code, forKey: .code)
        try container.encode(hostId, forKey: .hostId)
        try container.encode(players, forKey: .players)
        try container.encode(gameState, forKey: .gameState)
        try container.encode(settings, forKey: .settings)
        try container.encode(isActive, forKey: .isActive)
        
        // Encode dates in ISO8601 format
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        try container.encode(dateFormatter.string(from: createdAt), forKey: .createdAt)
        try container.encode(dateFormatter.string(from: lastActivity), forKey: .lastActivity)
    }
    
    var qrCodeData: String {
        return "poker://join/\(code)"
    }
    
    var canStartGame: Bool {
        return players.count >= 2 && status == .waiting
    }
    
    var isFull: Bool {
        return players.count >= settings.maxPlayers
    }
    
    
    static func generateRoomCode() -> String {
        let digits = "0123456789"
        return String((0..<6).map { _ in digits.randomElement()! })
    }
    
    func addPlayer(_ player: Player) -> Bool {
        guard !isFull && !players.contains(where: { $0.id == player.id }) else {
            return false
        }
        
        var newPlayer = player
        newPlayer.chips = settings.startingChips
        newPlayer.position = players.count
        
        players.append(newPlayer)
        gameState.addPlayer(newPlayer)
        
        return true
    }
    
    func removePlayer(withId playerId: String) {
        players.removeAll { $0.id == playerId }
        gameState.players.removeAll { $0.id == playerId }
        
        // Update positions
        for i in 0..<players.count {
            players[i].position = i
            if i < gameState.players.count {
                gameState.players[i].position = i
            }
        }
    }
    
    func startGame() -> Bool {
        guard canStartGame else { return false }
        
        gameState.startNewHand()
        
        return true
    }
    
    func endGame() {
        gameState.phase = .handComplete
    }
}