//
//  GameState.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import Foundation

enum GamePhase: String, CaseIterable, Codable {
    case waiting = "waiting"
    case preFlop = "preFlop"
    case flop = "flop"
    case turn = "turn"
    case river = "river"
    case showdown = "showdown"
    case handComplete = "handComplete"
}

enum HandRank: Int, CaseIterable, Comparable {
    case highCard = 1
    case pair = 2
    case twoPair = 3
    case threeOfAKind = 4
    case straight = 5
    case flush = 6
    case fullHouse = 7
    case fourOfAKind = 8
    case straightFlush = 9
    case royalFlush = 10
    
    var description: String {
        switch self {
        case .highCard: return "High Card"
        case .pair: return "Pair"
        case .twoPair: return "Two Pair"
        case .threeOfAKind: return "Three of a Kind"
        case .straight: return "Straight"
        case .flush: return "Flush"
        case .fullHouse: return "Full House"
        case .fourOfAKind: return "Four of a Kind"
        case .straightFlush: return "Straight Flush"
        case .royalFlush: return "Royal Flush"
        }
    }
    
    static func < (lhs: HandRank, rhs: HandRank) -> Bool {
        return lhs.rawValue < rhs.rawValue
    }
}

struct Hand: Comparable {
    let rank: HandRank
    let cards: [Card]
    let kickers: [Card]
    
    static func < (lhs: Hand, rhs: Hand) -> Bool {
        if lhs.rank != rhs.rank {
            return lhs.rank < rhs.rank
        }
        
        // Compare primary cards first
        for i in 0..<min(lhs.cards.count, rhs.cards.count) {
            if lhs.cards[i].rank != rhs.cards[i].rank {
                return lhs.cards[i].rank < rhs.cards[i].rank
            }
        }
        
        // Compare kickers
        for i in 0..<min(lhs.kickers.count, rhs.kickers.count) {
            if lhs.kickers[i].rank != rhs.kickers[i].rank {
                return lhs.kickers[i].rank < rhs.kickers[i].rank
            }
        }
        
        return false
    }
}

class GameState: ObservableObject, Codable {
    @Published var phase: GamePhase = .waiting
    @Published var communityCards: [Card] = []
    @Published var pot: Int = 0
    @Published var currentPlayerIndex: Int = 0
    @Published var dealerIndex: Int = 0
    @Published var smallBlindIndex: Int = 0
    @Published var bigBlindIndex: Int = 0
    @Published var currentBet: Int = 0
    @Published var minRaise: Int = 0
    @Published var isHandActive: Bool = false
    @Published var handNumber: Int = 0
    @Published var winners: [String] = []
    @Published var players: [Player] = []
    
    // For backward compatibility
    var currentPhase: GamePhase {
        get { phase }
        set { phase = newValue }
    }
    
    // Coding keys to match backend structure
    private enum CodingKeys: String, CodingKey {
        case phase, communityCards, pot, currentPlayerIndex, dealerIndex
        case smallBlindIndex, bigBlindIndex, currentBet, minRaise
        case isHandActive, handNumber, winners, players
    }
    
    init() {}
    
    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        phase = try container.decode(GamePhase.self, forKey: .phase)
        communityCards = try container.decode([Card].self, forKey: .communityCards)
        pot = try container.decode(Int.self, forKey: .pot)
        currentPlayerIndex = try container.decode(Int.self, forKey: .currentPlayerIndex)
        dealerIndex = try container.decode(Int.self, forKey: .dealerIndex)
        smallBlindIndex = try container.decode(Int.self, forKey: .smallBlindIndex)
        bigBlindIndex = try container.decode(Int.self, forKey: .bigBlindIndex)
        currentBet = try container.decode(Int.self, forKey: .currentBet)
        minRaise = try container.decode(Int.self, forKey: .minRaise)
        isHandActive = try container.decode(Bool.self, forKey: .isHandActive)
        handNumber = try container.decode(Int.self, forKey: .handNumber)
        winners = try container.decode([String].self, forKey: .winners)
        players = try container.decode([Player].self, forKey: .players)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(phase, forKey: .phase)
        try container.encode(communityCards, forKey: .communityCards)
        try container.encode(pot, forKey: .pot)
        try container.encode(currentPlayerIndex, forKey: .currentPlayerIndex)
        try container.encode(dealerIndex, forKey: .dealerIndex)
        try container.encode(smallBlindIndex, forKey: .smallBlindIndex)
        try container.encode(bigBlindIndex, forKey: .bigBlindIndex)
        try container.encode(currentBet, forKey: .currentBet)
        try container.encode(minRaise, forKey: .minRaise)
        try container.encode(isHandActive, forKey: .isHandActive)
        try container.encode(handNumber, forKey: .handNumber)
        try container.encode(winners, forKey: .winners)
        try container.encode(players, forKey: .players)
    }
    
    private var deck: [Card] = []
    let smallBlind: Int = 10
    let bigBlind: Int = 20
    
    var activePlayersCount: Int {
        return players.filter { $0.isInHand }.count
    }
    
    var currentPlayer: Player? {
        guard currentPlayerIndex < players.count else { return nil }
        return players[currentPlayerIndex]
    }
    
    func addPlayer(_ player: Player) {
        var newPlayer = player
        newPlayer.position = players.count
        players.append(newPlayer)
    }
    
    func startNewHand() {
        // Reset all players for new hand
        for i in 0..<players.count {
            players[i].resetForNewHand()
        }
        
        // Reset game state
        communityCards = []
        pot = 0
        phase = .preFlop
        currentBet = bigBlind
        minRaise = bigBlind
        isHandActive = true
        
        // Setup new deck
        deck = Card.standardDeck().shuffled()
        
        // Deal hole cards
        dealHoleCards()
        
        // Post blinds
        postBlinds()
        
        // Set first player to act (after big blind)
        currentPlayerIndex = getNextActivePlayer(after: bigBlindIndex)
    }
    
    private func dealHoleCards() {
        for _ in 0..<2 {
            for i in 0..<players.count {
                if players[i].isActive {
                    players[i].holeCards.append(deck.removeFirst())
                }
            }
        }
    }
    
    private func postBlinds() {
        // Small blind
        if smallBlindIndex < players.count {
            players[smallBlindIndex].bet(smallBlind)
            pot += smallBlind
        }
        
        // Big blind
        if bigBlindIndex < players.count {
            players[bigBlindIndex].bet(bigBlind)
            pot += bigBlind
        }
    }
    
    func playerAction(action: PlayerAction, amount: Int = 0) {
        guard currentPlayerIndex < players.count else { return }
        
        switch action {
        case .fold:
            players[currentPlayerIndex].fold()
        case .check:
            players[currentPlayerIndex].lastAction = .check
        case .call:
            let callAmount = currentBet - players[currentPlayerIndex].currentBet
            players[currentPlayerIndex].bet(callAmount)
            pot += callAmount
        case .raise:
            let totalBet = currentBet + amount
            let additionalBet = totalBet - players[currentPlayerIndex].currentBet
            players[currentPlayerIndex].bet(additionalBet)
            pot += additionalBet
            currentBet = totalBet
            minRaise = amount
        case .allIn:
            let allInAmount = players[currentPlayerIndex].chips
            players[currentPlayerIndex].bet(allInAmount)
            pot += allInAmount
        }
        
        // Move to next player or next phase
        moveToNextPlayer()
    }
    
    private func moveToNextPlayer() {
        // Check if betting round is complete
        if isBettingRoundComplete() {
            moveToNextPhase()
        } else {
            currentPlayerIndex = getNextActivePlayer(after: currentPlayerIndex)
        }
    }
    
    private func isBettingRoundComplete() -> Bool {
        let activePlayers = players.filter { $0.canAct }
        
        // If only one player can act, round is complete
        if activePlayers.count <= 1 {
            return true
        }
        
        // Check if all active players have acted and matched the current bet
        for player in activePlayers {
            if player.lastAction == nil || player.currentBet < currentBet {
                return false
            }
        }
        
        return true
    }
    
    private func moveToNextPhase() {
        // Reset player actions for new round
        for i in 0..<players.count {
            players[i].resetForNewRound()
        }
        currentBet = 0
        
        switch phase {
        case .waiting:
            break
        case .preFlop:
            phase = .flop
            dealFlop()
        case .flop:
            phase = .turn
            dealTurn()
        case .turn:
            phase = .river
            dealRiver()
        case .river:
            phase = .showdown
            determineWinner()
        case .showdown, .handComplete:
            endHand()
        }
        
        if phase != .showdown && phase != .handComplete {
            currentPlayerIndex = getNextActivePlayer(after: dealerIndex)
        }
    }
    
    private func dealFlop() {
        deck.removeFirst() // Burn card
        for _ in 0..<3 {
            communityCards.append(deck.removeFirst())
        }
    }
    
    private func dealTurn() {
        deck.removeFirst() // Burn card
        communityCards.append(deck.removeFirst())
    }
    
    private func dealRiver() {
        deck.removeFirst() // Burn card
        communityCards.append(deck.removeFirst())
    }
    
    private func determineWinner() {
        let activePlayers = players.enumerated().filter { $0.element.isInHand }
        
        // Evaluate hands for all active players
        var playerHands: [(Int, Hand)] = []
        for (index, player) in activePlayers {
            let hand = evaluateHand(player.holeCards + communityCards)
            playerHands.append((index, hand))
        }
        
        // Sort by hand strength (best first)
        playerHands.sort { $0.1 > $1.1 }
        
        // Award pot to winner(s)
        if let winnerIndex = playerHands.first?.0 {
            players[winnerIndex].chips += pot
        }
        
        phase = .handComplete
    }
    
    private func endHand() {
        // Move dealer button
        dealerIndex = getNextActivePlayer(after: dealerIndex)
        smallBlindIndex = getNextActivePlayer(after: dealerIndex)
        bigBlindIndex = getNextActivePlayer(after: smallBlindIndex)
        
        isHandActive = false
    }
    
    private func getNextActivePlayer(after index: Int) -> Int {
        var nextIndex = (index + 1) % players.count
        while !players[nextIndex].isActive && nextIndex != index {
            nextIndex = (nextIndex + 1) % players.count
        }
        return nextIndex
    }
    
    private func evaluateHand(_ cards: [Card]) -> Hand {
        // This is a simplified hand evaluation
        // In a real implementation, you'd want more sophisticated logic
        let sortedCards = cards.sorted { $0.rank > $1.rank }
        
        // Check for flush
        let suitCounts = Dictionary(grouping: cards, by: { $0.suit })
        let isFlush = suitCounts.values.contains { $0.count >= 5 }
        
        // Check for straight
        let ranks = Set(cards.map { $0.rank })
        let isStraight = checkStraight(ranks)
        
        // Count ranks
        let rankCounts = Dictionary(grouping: cards, by: { $0.rank })
            .mapValues { $0.count }
            .sorted { $0.value > $1.value }
        
        // Determine hand rank
        if isFlush && isStraight {
            return Hand(rank: .straightFlush, cards: Array(sortedCards.prefix(5)), kickers: [])
        } else if rankCounts.first?.value == 4 {
            return Hand(rank: .fourOfAKind, cards: Array(sortedCards.prefix(5)), kickers: [])
        } else if rankCounts.count >= 2 && rankCounts[0].value == 3 && rankCounts[1].value == 2 {
            return Hand(rank: .fullHouse, cards: Array(sortedCards.prefix(5)), kickers: [])
        } else if isFlush {
            return Hand(rank: .flush, cards: Array(sortedCards.prefix(5)), kickers: [])
        } else if isStraight {
            return Hand(rank: .straight, cards: Array(sortedCards.prefix(5)), kickers: [])
        } else if rankCounts.first?.value == 3 {
            return Hand(rank: .threeOfAKind, cards: Array(sortedCards.prefix(5)), kickers: [])
        } else if rankCounts.count >= 2 && rankCounts[0].value == 2 && rankCounts[1].value == 2 {
            return Hand(rank: .twoPair, cards: Array(sortedCards.prefix(5)), kickers: [])
        } else if rankCounts.first?.value == 2 {
            return Hand(rank: .pair, cards: Array(sortedCards.prefix(5)), kickers: [])
        } else {
            return Hand(rank: .highCard, cards: Array(sortedCards.prefix(5)), kickers: [])
        }
    }
    
    private func checkStraight(_ ranks: Set<Int>) -> Bool {
        let sortedRanks = ranks.sorted()
        for i in 0...(sortedRanks.count - 5) {
            var consecutive = true
            for j in 1..<5 {
                if sortedRanks[i + j] != sortedRanks[i] + j {
                    consecutive = false
                    break
                }
            }
            if consecutive {
                return true
            }
        }
        // Check for A-2-3-4-5 straight
        return ranks.contains(14) && ranks.contains(2) && ranks.contains(3) && ranks.contains(4) && ranks.contains(5)
    }
}