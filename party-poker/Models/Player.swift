//
//  Player.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import Foundation

enum PlayerAction: String, CaseIterable, Codable {
    case fold = "fold"
    case check = "check"
    case call = "call"
    case raise = "raise"
    case allIn = "allIn"
}

struct Player: Identifiable, Equatable, Codable {
    var id: String
    var nickname: String
    var chips: Int
    var holeCards: [Card] = []
    var position: Int = 0
    var isActive: Bool = true
    private var _isInHand: Bool = false
    var currentBet: Int = 0
    var totalBet: Int = 0
    var lastAction: PlayerAction? = nil
    var isDealer: Bool = false
    var isSmallBlind: Bool = false
    var isBigBlind: Bool = false
    var socketId: String? = nil
    private var _hasFolded: Bool = false
    private var _isAllIn: Bool = false
    
    // Computed property for backward compatibility
    var name: String {
        get { nickname }
        set { nickname = newValue }
    }
    
    var hasFolded: Bool {
        get { _hasFolded }
        set { _hasFolded = newValue }
    }
    
    var isAllIn: Bool {
        get { _isAllIn }
        set { _isAllIn = newValue }
    }
    
    var totalBetThisRound: Int {
        get { totalBet }
        set { totalBet = newValue }
    }
    
    init(name: String, chips: Int = 1000) {
        self.id = UUID().uuidString
        self.nickname = name
        self.chips = chips
    }
    
    // Coding keys to match backend structure
    private enum CodingKeys: String, CodingKey {
        case id, nickname, chips, holeCards, position, isActive
        case currentBet, totalBet, lastAction, isDealer, isSmallBlind, isBigBlind, socketId
        case _isInHand = "isInHand", _hasFolded = "hasFolded", _isAllIn = "isAllIn"
    }
    
    var isInHand: Bool {
        get { isActive && !hasFolded }
        set { _isInHand = newValue }
    }
    
    var canAct: Bool {
        return isActive && !hasFolded && !isAllIn
    }
    
    mutating func fold() {
        _hasFolded = true
        lastAction = .fold
    }
    
    mutating func bet(_ amount: Int) {
        let betAmount = min(amount, chips)
        chips -= betAmount
        currentBet += betAmount
        totalBetThisRound += betAmount
        
        if chips == 0 {
            _isAllIn = true
            lastAction = .allIn
        } else if currentBet == 0 {
            lastAction = .check
        } else {
            lastAction = amount > 0 ? .raise : .call
        }
    }
    
    mutating func resetForNewRound() {
        currentBet = 0
        totalBetThisRound = 0
        lastAction = nil
    }
    
    mutating func resetForNewHand() {
        holeCards = []
        currentBet = 0
        totalBetThisRound = 0
        _hasFolded = false
        _isAllIn = false
        lastAction = nil
    }
}