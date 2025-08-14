//
//  NetworkService.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import Foundation
import Combine
import SocketIO

class NetworkService: ObservableObject {
    @Published var isConnected = false
    @Published var connectionError: String?
    
    private var manager: SocketManager?
    private var socket: SocketIOClient?
    
    // Event subjects for reactive programming
    private let roomCreatedSubject = PassthroughSubject<RoomCreatedResponse, Never>()
    private let roomJoinedSubject = PassthroughSubject<RoomJoinedResponse, Never>()
    private let roomUpdatedSubject = PassthroughSubject<Room, Never>()
    private let roomErrorSubject = PassthroughSubject<String, Never>()
    private let gameEventSubject = PassthroughSubject<GameEvent, Never>()
    
    // Public publishers
    var roomCreated: AnyPublisher<RoomCreatedResponse, Never> {
        roomCreatedSubject.eraseToAnyPublisher()
    }
    
    var roomJoined: AnyPublisher<RoomJoinedResponse, Never> {
        roomJoinedSubject.eraseToAnyPublisher()
    }
    
    var roomUpdated: AnyPublisher<Room, Never> {
        roomUpdatedSubject.eraseToAnyPublisher()
    }
    
    var roomError: AnyPublisher<String, Never> {
        roomErrorSubject.eraseToAnyPublisher()
    }
    
    var gameEvent: AnyPublisher<GameEvent, Never> {
        gameEventSubject.eraseToAnyPublisher()
    }
    
    private let serverURL = "http://localhost:3001"
    
    func connect() {
        print("🌐 Connecting to server: \(serverURL)")
        
        guard let url = URL(string: serverURL) else {
            print("❌ Invalid server URL")
            connectionError = "Invalid server URL"
            return
        }
        
        // Create socket manager
        manager = SocketManager(socketURL: url, config: [
            .log(true),
            .compress,
            .reconnects(true),
            .reconnectAttempts(5),
            .reconnectWait(1),
            .randomizationFactor(0.5),
            .connectParams(["EIO": "4"]),
            .forceWebsockets(false),
            .enableSOCKSProxy(false)
        ])
        
        socket = manager?.defaultSocket
        
        setupEventHandlers()
        socket?.connect()
    }
    
    func disconnect() {
        print("🌐 Disconnecting from server")
        socket?.disconnect()
        socket = nil
        manager = nil
        isConnected = false
    }
    
    private func setupEventHandlers() {
        guard let socket = socket else { return }
        
        // Connection events
        socket.on(clientEvent: .connect) { [weak self] data, ack in
            print("✅ Connected to server")
            print("   Socket ID: \(self?.socket?.sid ?? "unknown")")
            DispatchQueue.main.async {
                self?.isConnected = true
                self?.connectionError = nil
            }
        }
        
        socket.on(clientEvent: .disconnect) { [weak self] data, ack in
            print("❌ Disconnected from server: \(data)")
            DispatchQueue.main.async {
                self?.isConnected = false
            }
        }
        
        socket.on(clientEvent: .error) { [weak self] data, ack in
            print("❌ Socket error: \(data)")
            if let error = data.first as? String {
                DispatchQueue.main.async {
                    self?.connectionError = error
                }
            }
        }
        
        socket.on(clientEvent: .reconnect) { [weak self] data, ack in
            print("🔄 Reconnected to server")
            DispatchQueue.main.async {
                self?.isConnected = true
                self?.connectionError = nil
            }
        }
        
        socket.on(clientEvent: .statusChange) { data, ack in
            print("🔄 Status change: \(data)")
        }
        
        socket.on(clientEvent: .reconnectAttempt) { data, ack in
            print("🔄 Reconnect attempt: \(data)")
        }
        
        // Room events
        socket.on("room:created") { [weak self] data, ack in
            self?.handleRoomCreated(data: data)
        }
        
        socket.on("room:joined") { [weak self] data, ack in
            self?.handleRoomJoined(data: data)
        }
        
        socket.on("room:updated") { [weak self] data, ack in
            self?.handleRoomUpdated(data: data)
        }
        
        socket.on("room:error") { [weak self] data, ack in
            self?.handleRoomError(data: data)
        }
        
        // Game events
        socket.on("game:event") { [weak self] data, ack in
            self?.handleGameEvent(data: data)
        }
        
        socket.on("player:turn") { data, ack in
            print("🎯 Player turn: \(data)")
        }
        
        // Error handling
        socket.on("error") { [weak self] data, ack in
            if let error = data.first as? String {
                print("❌ Server error: \(error)")
                DispatchQueue.main.async {
                    self?.roomErrorSubject.send(error)
                }
            }
        }
    }
    
    // MARK: - Room Actions
    
    func createRoom(hostNickname: String, settings: RoomSettings? = nil) {
        guard let socket = socket, isConnected else {
            print("❌ Not connected to server")
            roomErrorSubject.send("Not connected to server")
            return
        }
        
        let requestData: [String: Any] = [
            "hostNickname": hostNickname,
            "settings": settings?.toDictionary() ?? [:]
        ]
        
        print("🎮 Creating room with data: \(requestData)")
        socket.emit("room:create", requestData)
    }
    
    func joinRoom(code: String, nickname: String) {
        guard let socket = socket, isConnected else {
            print("❌ Not connected to server")
            roomErrorSubject.send("Not connected to server")
            return
        }
        
        let requestData: [String: Any] = [
            "roomCode": code.uppercased(),
            "nickname": nickname
        ]
        
        print("🔗 Joining room with data: \(requestData)")
        socket.emit("room:join", requestData)
    }
    
    func leaveRoom() {
        guard let socket = socket, isConnected else { return }
        
        print("🚪 Leaving room")
        socket.emit("room:leave")
    }
    
    func startGame() {
        guard let socket = socket, isConnected else {
            roomErrorSubject.send("Not connected to server")
            return
        }
        
        print("🎲 Starting game")
        socket.emit("game:start")
    }
    
    // MARK: - Event Handlers
    
    private func handleRoomCreated(data: [Any]) {
        print("✅ Room created event: \(data)")
        
        guard let responseDict = data.first as? [String: Any] else {
            print("❌ Invalid room created response format")
            return
        }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: responseDict)
            let response = try JSONDecoder().decode(RoomCreatedResponse.self, from: jsonData)
            
            DispatchQueue.main.async {
                self.roomCreatedSubject.send(response)
            }
        } catch {
            print("❌ Failed to decode room created response: \(error)")
        }
    }
    
    private func handleRoomJoined(data: [Any]) {
        print("✅ Room joined event: \(data)")
        
        guard let responseDict = data.first as? [String: Any] else {
            print("❌ Invalid room joined response format")
            return
        }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: responseDict)
            let response = try JSONDecoder().decode(RoomJoinedResponse.self, from: jsonData)
            
            DispatchQueue.main.async {
                self.roomJoinedSubject.send(response)
            }
        } catch {
            print("❌ Failed to decode room joined response: \(error)")
        }
    }
    
    private func handleRoomUpdated(data: [Any]) {
        print("🔄 Room updated event received")
        
        guard let roomDict = data.first as? [String: Any] else {
            print("❌ Invalid room updated format")
            return
        }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: roomDict)
            let room = try JSONDecoder().decode(Room.self, from: jsonData)
            
            print("✅ Room update decoded - \(room.players.count) players")
            
            DispatchQueue.main.async {
                self.roomUpdatedSubject.send(room)
            }
        } catch {
            print("❌ Failed to decode room updated: \(error)")
        }
    }
    
    private func handleRoomError(data: [Any]) {
        let errorMessage = data.first as? String ?? "Unknown room error"
        print("❌ Room error: \(errorMessage)")
        
        DispatchQueue.main.async {
            self.roomErrorSubject.send(errorMessage)
        }
    }
    
    private func handleGameEvent(data: [Any]) {
        print("🎲 Game event: \(data)")
        
        guard let eventDict = data.first as? [String: Any] else {
            print("❌ Invalid game event format")
            return
        }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: eventDict)
            let event = try JSONDecoder().decode(GameEvent.self, from: jsonData)
            
            DispatchQueue.main.async {
                self.gameEventSubject.send(event)
            }
        } catch {
            print("❌ Failed to decode game event: \(error)")
        }
    }
}

// MARK: - Response Models

struct RoomCreatedResponse: Codable {
    let room: Room
    let playerId: String
}

struct RoomJoinedResponse: Codable {
    let room: Room
    let playerId: String
}

struct GameEvent: Codable {
    let type: String
    let data: [String: AnyCodable]
    let timestamp: Date
    
    enum CodingKeys: String, CodingKey {
        case type
        case data
        case timestamp
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        data = try container.decode([String: AnyCodable].self, forKey: .data)
        
        // Handle timestamp as either Date or String
        if let timestampString = try? container.decode(String.self, forKey: .timestamp) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: timestampString) {
                timestamp = date
            } else {
                // Fallback to current date if parsing fails
                timestamp = Date()
            }
        } else {
            // Try to decode as Date directly (shouldn't happen but just in case)
            timestamp = try container.decode(Date.self, forKey: .timestamp)
        }
    }
}

// Helper for encoding/decoding any JSON value
struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case let string as String:
            try container.encode(string)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let bool as Bool:
            try container.encode(bool)
        case let array as [Any]:
            try container.encode(array.map(AnyCodable.init))
        case let dict as [String: Any]:
            try container.encode(dict.mapValues(AnyCodable.init))
        default:
            try container.encodeNil()
        }
    }
}

// Extension to convert RoomSettings to dictionary
extension RoomSettings {
    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "maxPlayers": maxPlayers,
            "minPlayers": minPlayers,
            "smallBlind": smallBlind,
            "bigBlind": bigBlind,
            "startingChips": startingChips
        ]
        
        // Only include timeLimit if it has a value
        if let timeLimit = timeLimit {
            dict["timeLimit"] = timeLimit
        }
        
        return dict
    }
}