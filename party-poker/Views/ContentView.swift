//
//  ContentView.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var roomManager = RoomManager()
    @State private var showingCreateRoom = false
    @State private var showingJoinRoom = false
    @State private var playerName = ""
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                // Title
                VStack {
                    Text("🎮 Party Poker")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                    
                    Text("Play poker with friends!")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    // Connection status indicator
                    HStack {
                        Circle()
                            .fill(roomManager.isConnected ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                        
                        Text(roomManager.isConnected ? "Connected to server" : "Connecting...")
                            .font(.caption)
                            .foregroundColor(roomManager.isConnected ? .green : .orange)
                    }
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)
                    
                    // Error message if any
                    if let error = roomManager.connectionError {
                        Text("⚠️ \(error)")
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding()
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(8)
                    }
                }
                .padding(.top, 50)
                
                Spacer()
                
                // Player name input
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your Name")
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    TextField("Enter your name", text: $playerName)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .font(.body)
                }
                .padding(.horizontal, 40)
                
                // Action buttons
                VStack(spacing: 20) {
                    Button(action: {
                        showingCreateRoom = true
                    }) {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Create Room")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(12)
                    }
                    .disabled(playerName.isEmpty || !roomManager.isConnected)
                    
                    Button(action: {
                        showingJoinRoom = true
                    }) {
                        HStack {
                            Image(systemName: "qrcode")
                            Text("Join Room")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .cornerRadius(12)
                    }
                    .disabled(playerName.isEmpty || !roomManager.isConnected)
                }
                .padding(.horizontal, 40)
                
                Spacer()
                
                // Current room info
                if let currentRoom = roomManager.currentRoom {
                    VStack {
                        Text("Current Room: \(currentRoom.code)")
                            .font(.headline)
                        
                        NavigationLink(
                            destination: RoomLobbyView(room: currentRoom, roomManager: roomManager, playerName: playerName),
                            isActive: .constant(true)
                        ) {
                            EmptyView()
                        }
                    }
                }
            }
            .navigationBarHidden(true)
        }
        .sheet(isPresented: $showingCreateRoom) {
            CreateRoomView(roomManager: roomManager, playerName: playerName)
        }
        .sheet(isPresented: $showingJoinRoom) {
            JoinRoomView(roomManager: roomManager, playerName: playerName)
        }
        .onAppear {
            print("ContentView: Appeared successfully")
            roomManager.connect()
        }
    }
}