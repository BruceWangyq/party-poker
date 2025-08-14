//
//  GameView.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import SwiftUI

struct GameView: View {
    @ObservedObject var room: Room
    let playerName: String
    @Environment(\.presentationMode) var presentationMode
    
    @State private var betAmount = 0
    @State private var showingBetSlider = false
    
    private var gameState: GameState {
        room.gameState
    }
    
    private var currentPlayer: Player? {
        guard gameState.currentPlayerIndex < gameState.players.count else { return nil }
        return gameState.players[gameState.currentPlayerIndex]
    }
    
    private var myPlayer: Player? {
        gameState.players.first { $0.name == playerName }
    }
    
    private var isMyTurn: Bool {
        currentPlayer?.name == playerName
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Top bar with game info
            HStack {
                Button("Leave") {
                    presentationMode.wrappedValue.dismiss()
                }
                .foregroundColor(.red)
                
                Spacer()
                
                VStack {
                    Text("Pot: $\(gameState.pot)")
                        .font(.headline)
                        .fontWeight(.bold)
                    
                    Text(gameState.currentPhase.rawValue)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Text("Room: \(room.code)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(UIColor.systemGray6))
            
            // Game table
            GeometryReader { geometry in
                ZStack {
                    // Table background
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color.green.opacity(0.8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(Color.brown, lineWidth: 8)
                        )
                        .padding(20)
                    
                    // Community cards
                    VStack {
                        Spacer()
                        
                        HStack(spacing: 8) {
                            ForEach(0..<5, id: \.self) { index in
                                if index < gameState.communityCards.count {
                                    CardView(card: gameState.communityCards[index])
                                } else {
                                    CardView(card: nil)
                                        .opacity(0.3)
                                }
                            }
                        }
                        
                        Spacer()
                        
                        // Current player indicator
                        if let current = currentPlayer {
                            Text("\(current.name)'s turn")
                                .font(.headline)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(20)
                        }
                        
                        Spacer()
                    }
                    
                    // Players around the table
                    ForEach(gameState.players.indices, id: \.self) { index in
                        PlayerSeatView(
                            player: gameState.players[index],
                            isCurrentPlayer: index == gameState.currentPlayerIndex,
                            isMe: gameState.players[index].name == playerName,
                            geometry: geometry,
                            position: index,
                            totalPlayers: gameState.players.count
                        )
                    }
                }
            }
            
            // My cards and controls
            VStack(spacing: 16) {
                // My hole cards
                if let player = myPlayer {
                    HStack(spacing: 12) {
                        Text("Your Cards:")
                            .font(.headline)
                        
                        HStack(spacing: 8) {
                            ForEach(player.holeCards, id: \.id) { card in
                                CardView(card: card, size: .small)
                            }
                        }
                        
                        Spacer()
                        
                        Text("Chips: $\(player.chips)")
                            .font(.headline)
                            .fontWeight(.bold)
                    }
                    .padding(.horizontal)
                }
                
                // Action buttons
                if isMyTurn && gameState.isHandActive {
                    VStack(spacing: 12) {
                        HStack(spacing: 12) {
                            Button("Fold") {
                                gameState.playerAction(action: .fold)
                            }
                            .buttonStyle(PokerButtonStyle(color: .red))
                            
                            if gameState.currentBet == 0 {
                                Button("Check") {
                                    gameState.playerAction(action: .check)
                                }
                                .buttonStyle(PokerButtonStyle(color: .blue))
                            } else {
                                Button("Call $\(gameState.currentBet)") {
                                    gameState.playerAction(action: .call)
                                }
                                .buttonStyle(PokerButtonStyle(color: .green))
                            }
                            
                            Button("Raise") {
                                showingBetSlider = true
                            }
                            .buttonStyle(PokerButtonStyle(color: .orange))
                        }
                        
                        if showingBetSlider {
                            VStack {
                                HStack {
                                    Text("Raise to: $\(betAmount)")
                                        .font(.headline)
                                    
                                    Spacer()
                                    
                                    Button("Cancel") {
                                        showingBetSlider = false
                                    }
                                    .foregroundColor(.red)
                                }
                                
                                Slider(
                                    value: Binding(
                                        get: { Double(betAmount) },
                                        set: { betAmount = Int($0) }
                                    ),
                                    in: Double(gameState.currentBet + gameState.minRaise)...Double(myPlayer?.chips ?? 0),
                                    step: Double(gameState.minRaise)
                                )
                                
                                Button("Raise to $\(betAmount)") {
                                    gameState.playerAction(action: .raise, amount: betAmount - gameState.currentBet)
                                    showingBetSlider = false
                                }
                                .buttonStyle(PokerButtonStyle(color: .orange))
                            }
                            .padding()
                            .background(Color(UIColor.systemGray6))
                            .cornerRadius(12)
                        }
                    }
                    .padding(.horizontal)
                } else if !gameState.isHandActive {
                    Button("Start New Hand") {
                        gameState.startNewHand()
                    }
                    .buttonStyle(PokerButtonStyle(color: .green))
                    .padding(.horizontal)
                }
            }
            .padding(.bottom)
        }
        .navigationBarHidden(true)
        .onAppear {
            if !gameState.isHandActive {
                gameState.startNewHand()
            }
        }
    }
}

struct CardView: View {
    let card: Card?
    var size: CardSize = .normal
    
    enum CardSize {
        case small, normal
        
        var dimensions: (width: CGFloat, height: CGFloat) {
            switch self {
            case .small:
                return (40, 56)
            case .normal:
                return (50, 70)
            }
        }
    }
    
    var body: some View {
        let dimensions = size.dimensions
        
        RoundedRectangle(cornerRadius: 8)
            .fill(card != nil ? Color.white : Color.gray.opacity(0.5))
            .frame(width: dimensions.width, height: dimensions.height)
            .overlay(
                Group {
                    if let card = card {
                        VStack(spacing: 2) {
                            Text(card.rankSymbol)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(card.color == .red ? .red : .black)
                            
                            Text(card.suitSymbol)
                                .font(.system(size: 10))
                        }
                    } else {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.blue.opacity(0.3))
                            .frame(width: dimensions.width - 4, height: dimensions.height - 4)
                    }
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.black.opacity(0.2), lineWidth: 1)
            )
    }
}

struct PlayerSeatView: View {
    let player: Player
    let isCurrentPlayer: Bool
    let isMe: Bool
    let geometry: GeometryProxy
    let position: Int
    let totalPlayers: Int
    
    private var seatPosition: CGPoint {
        let center = CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
        let radius = min(geometry.size.width, geometry.size.height) * 0.35
        let angle = (2 * Double.pi / Double(totalPlayers)) * Double(position) - Double.pi / 2
        
        return CGPoint(
            x: center.x + CoreGraphics.cos(angle) * radius,
            y: center.y + CoreGraphics.sin(angle) * radius
        )
    }
    
    var body: some View {
        VStack(spacing: 4) {
            // Player avatar
            Circle()
                .fill(isMe ? Color.blue : (isCurrentPlayer ? Color.green : Color.gray))
                .frame(width: 50, height: 50)
                .overlay(
                    Text(String(player.name.prefix(1).uppercased()))
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                )
                .overlay(
                    Circle()
                        .stroke(isCurrentPlayer ? Color.yellow : Color.clear, lineWidth: 3)
                )
            
            // Player info
            VStack(spacing: 2) {
                Text(player.name)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .lineLimit(1)
                
                Text("$\(player.chips)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                if player.currentBet > 0 {
                    Text("Bet: $\(player.currentBet)")
                        .font(.caption2)
                        .foregroundColor(.blue)
                }
                
                if player.hasFolded {
                    Text("FOLDED")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.red)
                }
            }
        }
        .position(seatPosition)
    }
}

struct PokerButtonStyle: ButtonStyle {
    let color: Color
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(color.opacity(configuration.isPressed ? 0.7 : 1.0))
            .cornerRadius(8)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
    }
}