//
//  PokerEngine.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import Foundation

class PokerEngine {
    
    // MARK: - Hand Evaluation
    
    static func evaluateHand(_ cards: [Card]) -> Hand {
        guard cards.count >= 5 else {
            return Hand(rank: .highCard, cards: cards.sorted { $0.rank > $1.rank }, kickers: [])
        }
        
        let sortedCards = cards.sorted { $0.rank > $1.rank }
        let rankGroups = Dictionary(grouping: cards, by: { $0.rank })
        let suitGroups = Dictionary(grouping: cards, by: { $0.suit })
        
        // Check for flush
        let flushSuit = suitGroups.first { $0.value.count >= 5 }?.key
        let flushCards = flushSuit != nil ? suitGroups[flushSuit!]!.sorted { $0.rank > $1.rank } : []
        
        // Check for straight
        let straightCards = findStraight(in: sortedCards)
        let straightFlushCards = flushCards.count >= 5 ? findStraight(in: flushCards) : []
        
        // Royal Flush
        if !straightFlushCards.isEmpty && straightFlushCards.first?.rank == 14 {
            return Hand(rank: .royalFlush, cards: Array(straightFlushCards.prefix(5)), kickers: [])
        }
        
        // Straight Flush
        if !straightFlushCards.isEmpty {
            return Hand(rank: .straightFlush, cards: Array(straightFlushCards.prefix(5)), kickers: [])
        }
        
        // Four of a Kind
        if let fourOfAKind = rankGroups.first(where: { $0.value.count == 4 }) {
            let fourCards = fourOfAKind.value.sorted { $0.rank > $1.rank }
            let kicker = sortedCards.first { $0.rank != fourOfAKind.key }
            return Hand(rank: .fourOfAKind, cards: fourCards, kickers: kicker != nil ? [kicker!] : [])
        }
        
        // Full House
        let threeOfAKinds = rankGroups.filter { $0.value.count == 3 }.sorted { $0.key > $1.key }
        let pairs = rankGroups.filter { $0.value.count == 2 }.sorted { $0.key > $1.key }
        
        if !threeOfAKinds.isEmpty && (!pairs.isEmpty || threeOfAKinds.count > 1) {
            let threeCards = threeOfAKinds.first!.value
            let pairCards = threeOfAKinds.count > 1 ? 
                Array(threeOfAKinds[1].value.prefix(2)) : 
                Array(pairs.first!.value.prefix(2))
            return Hand(rank: .fullHouse, cards: threeCards + pairCards, kickers: [])
        }
        
        // Flush
        if flushCards.count >= 5 {
            return Hand(rank: .flush, cards: Array(flushCards.prefix(5)), kickers: [])
        }
        
        // Straight
        if !straightCards.isEmpty {
            return Hand(rank: .straight, cards: Array(straightCards.prefix(5)), kickers: [])
        }
        
        // Three of a Kind
        if !threeOfAKinds.isEmpty {
            let threeCards = threeOfAKinds.first!.value
            let kickers = sortedCards.filter { $0.rank != threeOfAKinds.first!.key }.prefix(2)
            return Hand(rank: .threeOfAKind, cards: threeCards, kickers: Array(kickers))
        }
        
        // Two Pair
        if pairs.count >= 2 {
            let firstPair = pairs[0].value
            let secondPair = pairs[1].value
            let kicker = sortedCards.first { $0.rank != pairs[0].key && $0.rank != pairs[1].key }
            return Hand(rank: .twoPair, cards: firstPair + secondPair, kickers: kicker != nil ? [kicker!] : [])
        }
        
        // One Pair
        if !pairs.isEmpty {
            let pairCards = pairs.first!.value
            let kickers = sortedCards.filter { $0.rank != pairs.first!.key }.prefix(3)
            return Hand(rank: .pair, cards: pairCards, kickers: Array(kickers))
        }
        
        // High Card
        return Hand(rank: .highCard, cards: Array(sortedCards.prefix(5)), kickers: [])
    }
    
    private static func findStraight(in cards: [Card]) -> [Card] {
        let uniqueRanks = Array(Set(cards.map { $0.rank })).sorted { $0 > $1 }
        
        // Check for regular straight
        for i in 0...(uniqueRanks.count - 5) {
            var isStraight = true
            for j in 1..<5 {
                if uniqueRanks[i + j] != uniqueRanks[i] - j {
                    isStraight = false
                    break
                }
            }
            if isStraight {
                let straightRanks = Array(uniqueRanks[i..<(i + 5)])
                return straightRanks.compactMap { rank in
                    cards.first { $0.rank == rank }
                }
            }
        }
        
        // Check for A-2-3-4-5 straight (wheel)
        let wheelRanks: [Int] = [14, 2, 3, 4, 5]
        if wheelRanks.allSatisfy({ rank in uniqueRanks.contains(rank) }) {
            return wheelRanks.compactMap { rank in
                cards.first { $0.rank == rank }
            }
        }
        
        return []
    }
    
    // MARK: - Game Logic Helpers
    
    static func calculateMinimumRaise(currentBet: Int, lastRaise: Int, bigBlind: Int) -> Int {
        if currentBet == 0 {
            return bigBlind
        }
        return max(lastRaise, bigBlind)
    }
    
    static func calculateCallAmount(player: Player, currentBet: Int) -> Int {
        return max(0, currentBet - player.currentBet)
    }
    
    static func canPlayerRaise(player: Player, currentBet: Int, minRaise: Int) -> Bool {
        let callAmount = calculateCallAmount(player: player, currentBet: currentBet)
        return player.chips > callAmount + minRaise
    }
    
    static func getAllInAmount(player: Player) -> Int {
        return player.chips
    }
    
    // MARK: - Pot Calculation
    
    static func distributePot(players: [Player], pot: Int) -> [String: Int] {
        var winnings: [String: Int] = [:]
        var remainingPot = pot
        
        // Get all players who made it to showdown
        let activePlayerHands = players.filter { $0.isInHand }.map { player in
            (player.id, evaluateHand(player.holeCards), player.totalBetThisRound)
        }
        
        // Sort by hand strength (best first)
        let sortedHands = activePlayerHands.sorted { $0.1 > $1.1 }
        
        if let winner = sortedHands.first {
            winnings[winner.0] = remainingPot
        }
        
        return winnings
    }
    
    // MARK: - Side Pot Calculation
    
    static func calculateSidePots(players: [Player]) -> [(amount: Int, eligiblePlayers: [String])] {
        var sidePots: [(amount: Int, eligiblePlayers: [String])] = []
        let sortedPlayers = players.filter { $0.totalBetThisRound > 0 }
            .sorted { $0.totalBetThisRound < $1.totalBetThisRound }
        
        var previousBet = 0
        var remainingPlayers = Set(sortedPlayers.map { $0.id })
        
        for player in sortedPlayers {
            let potContribution = player.totalBetThisRound - previousBet
            if potContribution > 0 {
                let potAmount = potContribution * remainingPlayers.count
                sidePots.append((amount: potAmount, eligiblePlayers: Array(remainingPlayers)))
            }
            
            if player.isAllIn {
                remainingPlayers.remove(player.id)
            }
            
            previousBet = player.totalBetThisRound
        }
        
        return sidePots
    }
    
    // MARK: - Validation
    
    static func isValidBet(amount: Int, player: Player, currentBet: Int, minRaise: Int) -> Bool {
        let callAmount = calculateCallAmount(player: player, currentBet: currentBet)
        
        // Check if it's a valid call
        if amount == callAmount {
            return amount <= player.chips
        }
        
        // Check if it's a valid raise
        if amount >= callAmount + minRaise {
            return amount <= player.chips
        }
        
        // Check if it's all-in
        return amount == player.chips
    }
}