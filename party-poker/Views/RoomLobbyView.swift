//
//  RoomLobbyView.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import SwiftUI

struct RoomLobbyView: View {
    @ObservedObject var room: Room
    @ObservedObject var roomManager: RoomManager
    let playerName: String
    
    @State private var showingQRCode = false
    @State private var showingGameView = false
    
    var isHost: Bool {
        room.players.first?.name == playerName
    }
    
    var body: some View {
        VStack(spacing: 20) {
            // Room info header
            VStack(spacing: 10) {
                Text("Room: \(room.code)")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("\(room.players.count)/\(room.settings.maxPlayers) Players")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                HStack(spacing: 20) {
                    Button(action: {
                        showingQRCode = true
                    }) {
                        HStack {
                            Image(systemName: "qrcode")
                            Text("Show QR")
                        }
                        .font(.subheadline)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    
                    Button(action: {
                        UIPasteboard.general.string = room.code
                    }) {
                        HStack {
                            Image(systemName: "doc.on.doc")
                            Text("Copy Code")
                        }
                        .font(.subheadline)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                }
            }
            .padding()
            
            // Players list
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(room.players.indices, id: \.self) { index in
                        PlayerRowView(
                            player: room.players[index],
                            isHost: index == 0,
                            isCurrentPlayer: room.players[index].name == playerName
                        )
                    }
                }
                .padding(.horizontal)
            }
            
            Spacer()
            
            // Game settings info
            VStack(alignment: .leading, spacing: 8) {
                Text("Game Settings")
                    .font(.headline)
                    .padding(.horizontal)
                
                HStack {
                    VStack(alignment: .leading) {
                        Text("Blinds: \(room.settings.smallBlind)/\(room.settings.bigBlind)")
                        Text("Starting Chips: \(room.settings.startingChips)")
                    }
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    
                    Spacer()
                }
                .padding(.horizontal)
            }
            
            // Action buttons
            VStack(spacing: 12) {
                if isHost {
                    Button(action: startGame) {
                        Text("Start Game")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(room.canStartGame ? Color.green : Color.gray)
                            .cornerRadius(12)
                    }
                    .disabled(!room.canStartGame)
                    .padding(.horizontal)
                } else {
                    Text("Waiting for host to start the game...")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding()
                }
                
                Button(action: leaveRoom) {
                    Text("Leave Room")
                        .font(.headline)
                        .foregroundColor(.red)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.red, lineWidth: 2)
                        )
                }
                .padding(.horizontal)
            }
            .padding(.bottom)
        }
        .navigationTitle("Lobby")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingQRCode) {
            QRCodeView(room: room)
        }
        .fullScreenCover(isPresented: $showingGameView) {
            GameView(room: room, playerName: playerName)
        }
        .onChange(of: room.status) { _, status in
            if status == .playing {
                showingGameView = true
            }
        }
    }
    
    private func startGame() {
        roomManager.startGame()
        // The game view will be shown automatically when room status changes to .playing
        // via the onChange modifier above
    }
    
    private func leaveRoom() {
        roomManager.leaveRoom()
    }
}

struct PlayerRowView: View {
    let player: Player
    let isHost: Bool
    let isCurrentPlayer: Bool
    
    var body: some View {
        HStack {
            // Avatar
            Circle()
                .fill(isCurrentPlayer ? Color.blue : Color.gray)
                .frame(width: 40, height: 40)
                .overlay(
                    Text(String(player.name.prefix(1).uppercased()))
                        .font(.headline)
                        .foregroundColor(.white)
                )
            
            // Player info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(player.name)
                        .font(.headline)
                        .foregroundColor(isCurrentPlayer ? .blue : .primary)
                    
                    if isHost {
                        Text("HOST")
                            .font(.caption)
                            .fontWeight(.bold)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Color.orange)
                            .foregroundColor(.white)
                            .cornerRadius(4)
                    }
                }
                
                Text("Chips: \(player.chips)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Status indicator
            Circle()
                .fill(player.isActive ? Color.green : Color.red)
                .frame(width: 12, height: 12)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(UIColor.systemBackground))
                .shadow(color: Color.black.opacity(0.1), radius: 2, x: 0, y: 1)
        )
    }
}