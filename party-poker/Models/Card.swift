//
//  Card.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import Foundation

enum Suit: String, CaseIterable, Codable {
    case hearts = "♥️"
    case diamonds = "♦️"
    case clubs = "♣️"
    case spades = "♠️"
    
    var color: CardColor {
        switch self {
        case .hearts, .diamonds:
            return .red
        case .clubs, .spades:
            return .black
        }
    }
}

enum CardColor: Codable {
    case red
    case black
}

enum Rank: Int, CaseIterable, Comparable, Codable {
    case two = 2, three, four, five, six, seven, eight, nine, ten, jack, queen, king, ace
    
    var symbol: String {
        switch self {
        case .two: return "2"
        case .three: return "3"
        case .four: return "4"
        case .five: return "5"
        case .six: return "6"
        case .seven: return "7"
        case .eight: return "8"
        case .nine: return "9"
        case .ten: return "10"
        case .jack: return "J"
        case .queen: return "Q"
        case .king: return "K"
        case .ace: return "A"
        }
    }
    
    static func < (lhs: Rank, rhs: Rank) -> Bool {
        return lhs.rawValue < rhs.rawValue
    }
}

struct Card: Identifiable, Equatable, Hashable, Codable {
    let id: UUID
    let suit: String  // Changed to String to match backend
    let rank: Int     // Changed to Int to match backend
    
    init(suit: String, rank: Int) {
        self.id = UUID()
        self.suit = suit
        self.rank = rank
    }
    
    // Custom Codable implementation to handle missing id
    enum CodingKeys: String, CodingKey {
        case id, suit, rank
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // Try to decode id, generate new one if not present
        if let id = try? container.decode(UUID.self, forKey: .id) {
            self.id = id
        } else if let idString = try? container.decode(String.self, forKey: .id) {
            self.id = UUID(uuidString: idString) ?? UUID()
        } else {
            self.id = UUID()
        }
        
        self.suit = try container.decode(String.self, forKey: .suit)
        self.rank = try container.decode(Int.self, forKey: .rank)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(suit, forKey: .suit)
        try container.encode(rank, forKey: .rank)
    }
    
    var displayName: String {
        return "\(rankSymbol)\(suitSymbol)"
    }
    
    var value: Int {
        return rank
    }
    
    var suitSymbol: String {
        switch suit.lowercased() {
        case "hearts": return "♥️"
        case "diamonds": return "♦️"
        case "clubs": return "♣️"
        case "spades": return "♠️"
        default: return suit
        }
    }
    
    var rankSymbol: String {
        switch rank {
        case 2...10: return "\(rank)"
        case 11: return "J"
        case 12: return "Q"
        case 13: return "K"
        case 14, 1: return "A"
        default: return "\(rank)"
        }
    }
    
    var suitEnum: Suit? {
        switch suit.lowercased() {
        case "hearts": return .hearts
        case "diamonds": return .diamonds
        case "clubs": return .clubs
        case "spades": return .spades
        default: return nil
        }
    }
    
    var color: CardColor {
        switch suit.lowercased() {
        case "hearts", "diamonds":
            return .red
        case "clubs", "spades":
            return .black
        default:
            return .black
        }
    }
}

extension Card {
    static func standardDeck() -> [Card] {
        var deck: [Card] = []
        let suits = ["hearts", "diamonds", "clubs", "spades"]
        for suit in suits {
            for rank in 2...14 { // 2-10, J(11), Q(12), K(13), A(14)
                deck.append(Card(suit: suit, rank: rank))
            }
        }
        return deck
    }
}