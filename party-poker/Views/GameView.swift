//
//  GameView.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import SwiftUI

// Device category for responsive design across popular iPhone models
private enum DeviceCategory {
    case iPhone16ProMax, iPhone16Plus, iPhone16Pro, iPhone16, iPhone14Pro, iPhone13Mini, iPhone8Plus, iPhoneSE
    
    var scaleFactor: CGFloat {
        switch self {
        case .iPhone16ProMax, .iPhone16Plus: return 1.2
        case .iPhone16Pro, .iPhone16: return 1.1
        case .iPhone14Pro: return 1.0
        case .iPhone13Mini: return 0.9
        case .iPhone8Plus: return 0.95
        case .iPhoneSE: return 0.8
        }
    }
    
    var isCompact: Bool {
        switch self {
        case .iPhone13Mini, .iPhoneSE: return true
        default: return false
        }
    }
}

struct GameView: View {
    @ObservedObject var room: Room
    @ObservedObject var roomManager: RoomManager
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
        GeometryReader { fullGeometry in
            let isLandscape = fullGeometry.size.width > fullGeometry.size.height
            let screenWidth = fullGeometry.size.width
            let screenHeight = fullGeometry.size.height
            
            // Determine device category for responsive design
            let deviceCategory = getDeviceCategory(width: screenWidth, height: screenHeight)
            
            if isLandscape {
                // Landscape Layout
                HStack(spacing: 0) {
                    Text("Landscape mode - Coming soon!")
                        .font(.headline)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.gray.opacity(0.1))
                }
            } else {
                // Portrait Layout
                VStack(spacing: 0) {
                    // Portrait layout content here
                    createTopBar(scaleFactor: deviceCategory.scaleFactor)
                    
                    GeometryReader { tableGeometry in
                        createTable(geometry: tableGeometry, scaleFactor: deviceCategory.scaleFactor)
                    }
                    
                    createPlayerControls(scaleFactor: deviceCategory.scaleFactor)
                }
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            // Remove local hand starting - this should be handled by the server
        }
    }
    
    // Device category detection for popular iPhone models
    private func getDeviceCategory(width: CGFloat, height: CGFloat) -> DeviceCategory {
        let maxDimension = max(width, height)
        let minDimension = min(width, height)
        
        switch maxDimension {
        case 932: return .iPhone16ProMax // iPhone 16 Pro Max
        case 926: return .iPhone16Plus   // iPhone 16 Plus
        case 874: return .iPhone16Pro    // iPhone 16 Pro
        case 852: return .iPhone16       // iPhone 16
        case 844: return .iPhone14Pro    // iPhone 14 Pro, 15, 15 Pro
        case 812: return .iPhone13Mini   // iPhone 13 mini, 12 mini
        case 736: return .iPhone8Plus    // iPhone 8 Plus, 7 Plus, 6s Plus
        case 667: return .iPhoneSE       // iPhone SE, 8, 7, 6s
        default:
            // Fallback based on screen size
            if maxDimension > 900 {
                return .iPhone16ProMax
            } else if maxDimension > 850 {
                return .iPhone16Pro
            } else if maxDimension > 800 {
                return .iPhone14Pro
            } else {
                return .iPhoneSE
            }
        }
    }
    
    
    @ViewBuilder
    private func createTopBar(scaleFactor: CGFloat) -> some View {
        // Enhanced top bar with game info
        HStack {
            Button("Leave") {
                presentationMode.wrappedValue.dismiss()
            }
            .font(.system(size: 16 * scaleFactor, weight: .medium))
            .foregroundColor(.red)
            .padding(.horizontal, 12 * scaleFactor)
            .padding(.vertical, 6 * scaleFactor)
            .background(Color.red.opacity(0.1))
            .cornerRadius(8 * scaleFactor)
            
            Spacer()
            
            VStack(spacing: 2 * scaleFactor) {
                Text("Pot: $\(gameState.pot)")
                    .font(.system(size: 20 * scaleFactor, weight: .bold))
                    .foregroundColor(.primary)
                
                Text(gameState.currentPhase.rawValue)
                    .font(.system(size: 14 * scaleFactor, weight: .medium))
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8 * scaleFactor)
                    .padding(.vertical, 2 * scaleFactor)
                    .background(Color.secondary.opacity(0.1))
                    .cornerRadius(6 * scaleFactor)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2 * scaleFactor) {
                Text("Room: \(room.code)")
                    .font(.system(size: 14 * scaleFactor, weight: .semibold))
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8 * scaleFactor)
                    .padding(.vertical, 4 * scaleFactor)
                    .background(Color.secondary.opacity(0.1))
                    .cornerRadius(6 * scaleFactor)
            }
        }
        .padding(16 * scaleFactor)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [Color(UIColor.systemBackground), Color(UIColor.systemGray6)]),
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .overlay(
            Rectangle()
                .fill(Color.secondary.opacity(0.2))
                .frame(height: 0.5),
            alignment: .bottom
        )
    }
    
    @ViewBuilder
    private func createTable(geometry: GeometryProxy, scaleFactor: CGFloat) -> some View {
        let minDimension = min(geometry.size.width, geometry.size.height)
        let maxDimension = max(geometry.size.width, geometry.size.height)
        let aspectRatio = maxDimension / minDimension
        
        // Responsive padding and corner radius
        let responsivePadding = max(25, minDimension * 0.08)
        let cornerRadius = max(20, minDimension * 0.06)
        
        ZStack {
            // Enhanced table background with gradient and shadow
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    RadialGradient(
                        gradient: Gradient(colors: [
                            Color.green.opacity(0.9),
                            Color.green.opacity(0.7),
                            Color.green.opacity(0.6)
                        ]),
                        center: .center,
                        startRadius: minDimension * 0.1,
                        endRadius: minDimension * 0.4
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(
                            LinearGradient(
                                gradient: Gradient(colors: [Color.brown.opacity(0.8), Color.brown]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: max(4, minDimension * 0.015)
                        )
                )
                .shadow(color: Color.black.opacity(0.2), radius: max(6, minDimension * 0.02), x: 0, y: max(3, minDimension * 0.01))
                .padding(responsivePadding)
            
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
                
                // Enhanced current player indicator
                if let current = currentPlayer {
                    Text("\(current.name)'s turn")
                        .font(.system(size: 16, weight: .semibold))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [Color.blue, Color.blue.opacity(0.8)]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .foregroundColor(.white)
                        .cornerRadius(25)
                        .shadow(color: Color.blue.opacity(0.4), radius: 4, x: 0, y: 2)
                        .overlay(
                            RoundedRectangle(cornerRadius: 25)
                                .stroke(Color.white.opacity(0.3), lineWidth: 1)
                        )
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
    
    @ViewBuilder
    private func createPlayerControls(scaleFactor: CGFloat) -> some View {
        // Enhanced my cards and controls section
        VStack(spacing: 16) {
            // Player cards section
            createPlayerCards(scaleFactor: scaleFactor)
            
            // Action buttons section
            createActionButtons(scaleFactor: scaleFactor)
        }
        .padding(.bottom)
    }
    
    @ViewBuilder
    private func createPlayerCards(scaleFactor: CGFloat) -> some View {
        // Enhanced my hole cards
        if let player = myPlayer {
            HStack(spacing: 16) {
                Text("Your Cards:")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
                
                HStack(spacing: 10) {
                    ForEach(player.holeCards, id: \.id) { card in
                        CardView(card: card, size: .small)
                            .shadow(color: Color.black.opacity(0.1), radius: 2, x: 0, y: 1)
                    }
                }
                
                Spacer()
                
                HStack(spacing: 4) {
                    Image(systemName: "dollarsign.circle.fill")
                        .foregroundColor(.green)
                        .font(.system(size: 16))
                    Text("$\(player.chips)")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.primary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.green.opacity(0.1))
                .cornerRadius(12)
            }
            .padding(.horizontal)
        }
    }
    
    @ViewBuilder
    private func createActionButtons(scaleFactor: CGFloat) -> some View {
        // Action buttons
        if isMyTurn && gameState.isHandActive {
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    Button("Fold") {
                        roomManager.sendPlayerAction(action: .fold)
                    }
                    .buttonStyle(PokerButtonStyle(color: .red))
                    
                    if gameState.currentBet == 0 {
                        Button("Check") {
                            roomManager.sendPlayerAction(action: .check)
                        }
                        .buttonStyle(PokerButtonStyle(color: .blue))
                    } else {
                        Button("Call $\(gameState.currentBet)") {
                            roomManager.sendPlayerAction(action: .call)
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
                            roomManager.sendPlayerAction(action: .raise, amount: betAmount - gameState.currentBet)
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
                // This should be handled by the server now, not locally
                // The server will automatically start new hands
            }
            .buttonStyle(PokerButtonStyle(color: .green))
            .padding(.horizontal)
            .disabled(true) // Disable local hand start
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
            
            var fontSize: (rank: CGFloat, suit: CGFloat) {
                switch self {
                case .small:
                    return (12, 10)
                case .normal:
                    return (14, 12)
                }
            }
        }
        
        var body: some View {
            let dimensions = size.dimensions
            let fontSize = size.fontSize
            
            RoundedRectangle(cornerRadius: 10)
                .fill(
                    card != nil ?
                    LinearGradient(
                        gradient: Gradient(colors: [Color.white, Color.white.opacity(0.95)]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ) :
                        LinearGradient(
                            gradient: Gradient(colors: [Color.gray.opacity(0.5), Color.gray.opacity(0.3)]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                )
                .frame(width: dimensions.width, height: dimensions.height)
                .overlay(
                    Group {
                        if let card = card {
                            VStack(spacing: 1) {
                                Text(card.rankSymbol)
                                    .font(.system(size: fontSize.rank, weight: .bold))
                                    .foregroundColor(card.color == .red ? .red : .black)
                                
                                Text(card.suitSymbol)
                                    .font(.system(size: fontSize.suit, weight: .semibold))
                                    .foregroundColor(card.color == .red ? .red : .black)
                            }
                        } else {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(
                                    LinearGradient(
                                        gradient: Gradient(colors: [Color.blue.opacity(0.4), Color.blue.opacity(0.2)]),
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: dimensions.width - 4, height: dimensions.height - 4)
                        }
                    }
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(
                            card != nil ?
                            LinearGradient(
                                gradient: Gradient(colors: [Color.black.opacity(0.3), Color.black.opacity(0.1)]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ) :
                                LinearGradient(
                                    gradient: Gradient(colors: [Color.gray.opacity(0.4), Color.gray.opacity(0.2)]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                            lineWidth: 1.5
                        )
                )
                .shadow(color: Color.black.opacity(0.1), radius: 2, x: 0, y: 1)
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
            let screenWidth = geometry.size.width
            let screenHeight = geometry.size.height
            
            // Responsive radius calculation based on screen size
            let minDimension = min(screenWidth, screenHeight)
            let maxDimension = max(screenWidth, screenHeight)
            
            // Adjust radius based on aspect ratio and screen size
            let aspectRatio = maxDimension / minDimension
            let baseRadiusMultiplier: CGFloat
            
            if aspectRatio > 2.0 { // Very tall screens (iPhone 16 Pro)
                baseRadiusMultiplier = 0.32
            } else if aspectRatio > 1.8 { // Tall screens (iPhone 16)
                baseRadiusMultiplier = 0.35
            } else { // More square screens
                baseRadiusMultiplier = 0.38
            }
            
            let baseRadius = minDimension * baseRadiusMultiplier
            
            // Add responsive spacing based on screen size
            let spacingMultiplier = max(15, minDimension * 0.04)
            let radius = baseRadius + spacingMultiplier
            
            let angle = (2 * Double.pi / Double(totalPlayers)) * Double(position) - Double.pi / 2
            
            let x = center.x + CoreGraphics.cos(angle) * radius
            let y = center.y + CoreGraphics.sin(angle) * radius
            
            // Responsive margin based on screen size
            let margin = max(40, minDimension * 0.08)
            let clampedX = max(margin, min(screenWidth - margin, x))
            let clampedY = max(margin, min(screenHeight - margin, y))
            
            return CGPoint(x: clampedX, y: clampedY)
        }
        
        var body: some View {
            let minDimension = min(geometry.size.width, geometry.size.height)
            let maxDimension = max(geometry.size.width, geometry.size.height)
            let aspectRatio = maxDimension / minDimension
            
            // Responsive sizing based on screen dimensions
            let avatarSize = max(40, minDimension * 0.12)
            let avatarFontSize = max(14, avatarSize * 0.35)
            let spacing = max(4, minDimension * 0.015)
            
            VStack(spacing: spacing) {
                // Enhanced player avatar with responsive sizing
                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                isMe ? Color.blue : (isCurrentPlayer ? Color.green : Color.gray),
                                isMe ? Color.blue.opacity(0.8) : (isCurrentPlayer ? Color.green.opacity(0.8) : Color.gray.opacity(0.8))
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: avatarSize, height: avatarSize)
                    .overlay(
                        Text(String(player.name.prefix(1).uppercased()))
                            .font(.system(size: avatarFontSize, weight: .bold))
                            .foregroundColor(.white)
                            .shadow(color: Color.black.opacity(0.3), radius: 1, x: 0, y: 1)
                    )
                    .overlay(
                        Circle()
                            .stroke(
                                isCurrentPlayer ?
                                LinearGradient(
                                    gradient: Gradient(colors: [Color.yellow, Color.orange]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ) :
                                    LinearGradient(
                                        gradient: Gradient(colors: [Color.clear]),
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                lineWidth: 3
                            )
                    )
                    .shadow(color: Color.black.opacity(0.2), radius: 4, x: 0, y: 2)
                
                // Enhanced player info - responsive compact design
                let nameFontSize = max(9, minDimension * 0.025)
                let chipsFontSize = max(7, minDimension * 0.02)
                let betFontSize = max(7, minDimension * 0.019)
                let foldFontSize = max(6, minDimension * 0.017)
                let maxWidth = max(45, minDimension * 0.13)
                
                VStack(spacing: max(1, minDimension * 0.003)) {
                    Text(player.name)
                        .font(.system(size: nameFontSize, weight: .semibold))
                        .lineLimit(1)
                        .foregroundColor(.primary)
                        .padding(.horizontal, max(3, minDimension * 0.01))
                        .padding(.vertical, max(1, minDimension * 0.002))
                        .background(Color.white.opacity(0.9))
                        .cornerRadius(max(4, minDimension * 0.012))
                        .shadow(color: Color.black.opacity(0.1), radius: 1, x: 0, y: 0.5)
                    
                    Text("$\(player.chips)")
                        .font(.system(size: chipsFontSize, weight: .medium))
                        .foregroundColor(.secondary)
                        .padding(.horizontal, max(2, minDimension * 0.007))
                        .padding(.vertical, max(0.5, minDimension * 0.0015))
                        .background(Color.secondary.opacity(0.1))
                        .cornerRadius(max(3, minDimension * 0.008))
                    
                    if player.currentBet > 0 {
                        Text("$\(player.currentBet)")
                            .font(.system(size: betFontSize, weight: .medium))
                            .foregroundColor(.white)
                            .padding(.horizontal, max(3, minDimension * 0.008))
                            .padding(.vertical, max(1, minDimension * 0.002))
                            .background(Color.blue)
                            .cornerRadius(max(3, minDimension * 0.008))
                            .shadow(color: Color.blue.opacity(0.3), radius: 1, x: 0, y: 0.5)
                    }
                    
                    if player.hasFolded {
                        Text("FOLD")
                            .font(.system(size: foldFontSize, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, max(2, minDimension * 0.006))
                            .padding(.vertical, max(0.5, minDimension * 0.0015))
                            .background(Color.red)
                            .cornerRadius(max(2, minDimension * 0.006))
                            .shadow(color: Color.red.opacity(0.3), radius: 1, x: 0, y: 0.5)
                    }
                }
                .frame(maxWidth: maxWidth)
            }
            .position(seatPosition)
        }
    }
    
    struct PokerButtonStyle: ButtonStyle {
        let color: Color
        
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
                .background(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            color.opacity(configuration.isPressed ? 0.8 : 1.0),
                            color.opacity(configuration.isPressed ? 0.6 : 0.8)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .cornerRadius(12)
                .shadow(color: color.opacity(0.3), radius: configuration.isPressed ? 2 : 4, x: 0, y: configuration.isPressed ? 1 : 2)
                .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )
                .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
        }
    }
    
    struct CompactPokerButtonStyle: ButtonStyle {
        let color: Color
        let scaleFactor: CGFloat
        
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .font(.system(size: 12 * scaleFactor, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 16 * scaleFactor)
                .padding(.vertical, 8 * scaleFactor)
                .background(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            color.opacity(configuration.isPressed ? 0.8 : 1.0),
                            color.opacity(configuration.isPressed ? 0.6 : 0.8)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .cornerRadius(8 * scaleFactor)
                .shadow(color: color.opacity(0.3), radius: configuration.isPressed ? 1 : 2, x: 0, y: configuration.isPressed ? 0.5 : 1)
                .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
                .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
        }
    }
    
    struct LandscapePlayerSeatView: View {
        let player: Player
        let isCurrentPlayer: Bool
        let isMe: Bool
        let geometry: GeometryProxy
        let position: Int
        let totalPlayers: Int
        let scaleFactor: CGFloat
        
        private var seatPosition: CGPoint {
            let center = CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
            let screenWidth = geometry.size.width
            let screenHeight = geometry.size.height
            
            // Landscape positioning - more elliptical layout
            let radiusX = screenWidth * 0.35 * scaleFactor
            let radiusY = screenHeight * 0.28 * scaleFactor
            
            let angle = (2 * Double.pi / Double(totalPlayers)) * Double(position) - Double.pi / 2
            
            let x = center.x + CoreGraphics.cos(angle) * radiusX
            let y = center.y + CoreGraphics.sin(angle) * radiusY
            
            // Ensure players stay within bounds
            let margin = 30 * scaleFactor
            let clampedX = max(margin, min(screenWidth - margin, x))
            let clampedY = max(margin, min(screenHeight - margin, y))
            
            return CGPoint(x: clampedX, y: clampedY)
        }
        
        var body: some View {
            let avatarSize = 36 * scaleFactor
            let avatarFontSize = 12 * scaleFactor
            let spacing = 3 * scaleFactor
            
            VStack(spacing: spacing) {
                // Compact player avatar for landscape
                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                isMe ? Color.blue : (isCurrentPlayer ? Color.green : Color.gray),
                                isMe ? Color.blue.opacity(0.8) : (isCurrentPlayer ? Color.green.opacity(0.8) : Color.gray.opacity(0.8))
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: avatarSize, height: avatarSize)
                    .overlay(
                        Text(String(player.name.prefix(1).uppercased()))
                            .font(.system(size: avatarFontSize, weight: .bold))
                            .foregroundColor(.white)
                            .shadow(color: Color.black.opacity(0.3), radius: 1, x: 0, y: 0.5)
                    )
                    .overlay(
                        Circle()
                            .stroke(
                                isCurrentPlayer ?
                                LinearGradient(
                                    gradient: Gradient(colors: [Color.yellow, Color.orange]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ) :
                                    LinearGradient(
                                        gradient: Gradient(colors: [Color.clear]),
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                lineWidth: 2
                            )
                    )
                    .shadow(color: Color.black.opacity(0.2), radius: 2, x: 0, y: 1)
                
                // Ultra-compact player info for landscape
                VStack(spacing: 1) {
                    Text(player.name)
                        .font(.system(size: 8 * scaleFactor, weight: .semibold))
                        .lineLimit(1)
                        .foregroundColor(.primary)
                        .padding(.horizontal, 3 * scaleFactor)
                        .padding(.vertical, 1)
                        .background(Color.white.opacity(0.9))
                        .cornerRadius(3 * scaleFactor)
                        .shadow(color: Color.black.opacity(0.1), radius: 1, x: 0, y: 0.5)
                    
                    Text("$\(player.chips)")
                        .font(.system(size: 6 * scaleFactor, weight: .medium))
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 2 * scaleFactor)
                        .padding(.vertical, 0.5)
                        .background(Color.secondary.opacity(0.1))
                        .cornerRadius(2 * scaleFactor)
                    
                    if player.currentBet > 0 {
                        Text("$\(player.currentBet)")
                            .font(.system(size: 6 * scaleFactor, weight: .medium))
                            .foregroundColor(.white)
                            .padding(.horizontal, 2 * scaleFactor)
                            .padding(.vertical, 0.5)
                            .background(Color.blue)
                            .cornerRadius(2 * scaleFactor)
                            .shadow(color: Color.blue.opacity(0.3), radius: 1, x: 0, y: 0.5)
                    }
                    
                    if player.hasFolded {
                        Text("FOLD")
                            .font(.system(size: 5 * scaleFactor, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 2 * scaleFactor)
                            .padding(.vertical, 0.5)
                            .background(Color.red)
                            .cornerRadius(2 * scaleFactor)
                            .shadow(color: Color.red.opacity(0.3), radius: 1, x: 0, y: 0.5)
                    }
                }
                .frame(maxWidth: 40 * scaleFactor)
            }
            .position(seatPosition)
        }
    }
}
