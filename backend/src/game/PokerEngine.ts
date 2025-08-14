import { 
  Card, 
  CardRank, 
  CardSuit, 
  Hand, 
  HandRank, 
  Player,
  GameState,
  GamePhase,
  PlayerAction
} from '../types';
import { createDeck, shuffle } from '../utils/helpers';
import logger from '../utils/logger';

export class PokerEngine {
  /**
   * Evaluate the best 5-card hand from 7 cards (2 hole cards + 5 community cards)
   */
  static evaluateHand(cards: Card[]): Hand {
    if (cards.length < 5) {
      throw new Error('Need at least 5 cards to evaluate hand');
    }

    const allCombinations = this.getCombinations(cards, 5);
    let bestHand: Hand | null = null;

    for (const combination of allCombinations) {
      const hand = this.evaluateExactHand(combination);
      if (!bestHand || this.compareHands(hand, bestHand) > 0) {
        bestHand = hand;
      }
    }

    return bestHand!;
  }

  /**
   * Evaluate exactly 5 cards to determine hand rank
   */
  private static evaluateExactHand(cards: Card[]): Hand {
    if (cards.length !== 5) {
      throw new Error('Must evaluate exactly 5 cards');
    }

    const sortedCards = [...cards].sort((a, b) => b.rank - a.rank);
    const ranks = sortedCards.map(card => card.rank);
    const suits = sortedCards.map(card => card.suit);

    // Check for flush
    const isFlush = suits.every(suit => suit === suits[0]);

    // Check for straight
    const isStraight = this.isStraight(ranks);
    const isWheelStraight = this.isWheelStraight(ranks); // A-2-3-4-5

    // Count rank occurrences
    const rankCounts = this.countRanks(ranks);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    // Determine hand rank
    if (isFlush && (isStraight || isWheelStraight)) {
      if (ranks[0] === CardRank.Ace && isStraight) {
        return {
          rank: HandRank.RoyalFlush,
          cards: sortedCards,
          kickers: [],
          description: 'Royal Flush'
        };
      }
      return {
        rank: HandRank.StraightFlush,
        cards: isWheelStraight ? this.arrangeWheelStraight(sortedCards) : sortedCards,
        kickers: [],
        description: 'Straight Flush'
      };
    }

    if (counts[0] === 4) {
      const { primaryCards, kickers } = this.separateCardsByRank(sortedCards, rankCounts, [4]);
      return {
        rank: HandRank.FourOfAKind,
        cards: primaryCards,
        kickers,
        description: 'Four of a Kind'
      };
    }

    if (counts[0] === 3 && counts[1] === 2) {
      const { primaryCards } = this.separateCardsByRank(sortedCards, rankCounts, [3, 2]);
      return {
        rank: HandRank.FullHouse,
        cards: primaryCards,
        kickers: [],
        description: 'Full House'
      };
    }

    if (isFlush) {
      return {
        rank: HandRank.Flush,
        cards: sortedCards,
        kickers: [],
        description: 'Flush'
      };
    }

    if (isStraight || isWheelStraight) {
      return {
        rank: HandRank.Straight,
        cards: isWheelStraight ? this.arrangeWheelStraight(sortedCards) : sortedCards,
        kickers: [],
        description: 'Straight'
      };
    }

    if (counts[0] === 3) {
      const { primaryCards, kickers } = this.separateCardsByRank(sortedCards, rankCounts, [3]);
      return {
        rank: HandRank.ThreeOfAKind,
        cards: primaryCards,
        kickers,
        description: 'Three of a Kind'
      };
    }

    if (counts[0] === 2 && counts[1] === 2) {
      const { primaryCards, kickers } = this.separateCardsByRank(sortedCards, rankCounts, [2, 2]);
      return {
        rank: HandRank.TwoPair,
        cards: primaryCards,
        kickers,
        description: 'Two Pair'
      };
    }

    if (counts[0] === 2) {
      const { primaryCards, kickers } = this.separateCardsByRank(sortedCards, rankCounts, [2]);
      return {
        rank: HandRank.Pair,
        cards: primaryCards,
        kickers,
        description: 'Pair'
      };
    }

    return {
      rank: HandRank.HighCard,
      cards: sortedCards.slice(0, 5),
      kickers: [],
      description: 'High Card'
    };
  }

  /**
   * Compare two hands - returns > 0 if hand1 wins, < 0 if hand2 wins, 0 if tie
   */
  static compareHands(hand1: Hand, hand2: Hand): number {
    // Compare hand ranks first
    if (hand1.rank !== hand2.rank) {
      return hand1.rank - hand2.rank;
    }

    // For same hand ranks, compare primary cards then kickers
    const cards1 = [...hand1.cards, ...hand1.kickers];
    const cards2 = [...hand2.cards, ...hand2.kickers];

    for (let i = 0; i < Math.min(cards1.length, cards2.length); i++) {
      if (cards1[i].rank !== cards2[i].rank) {
        return cards1[i].rank - cards2[i].rank;
      }
    }

    return 0; // Complete tie
  }

  /**
   * Get all combinations of k elements from array
   */
  private static getCombinations<T>(arr: T[], k: number): T[][] {
    if (k === 1) return arr.map(el => [el]);
    if (k === arr.length) return [arr];

    const result: T[][] = [];
    const [first, ...rest] = arr;

    // Include first element
    const withFirst = this.getCombinations(rest, k - 1);
    withFirst.forEach(combo => result.push([first, ...combo]));

    // Exclude first element
    const withoutFirst = this.getCombinations(rest, k);
    result.push(...withoutFirst);

    return result;
  }

  /**
   * Check if ranks form a straight (excluding wheel)
   */
  private static isStraight(ranks: number[]): boolean {
    const sortedRanks = [...new Set(ranks)].sort((a, b) => a - b);
    if (sortedRanks.length !== 5) return false;

    for (let i = 1; i < sortedRanks.length; i++) {
      if (sortedRanks[i] !== sortedRanks[i - 1] + 1) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if ranks form a wheel straight (A-2-3-4-5)
   */
  private static isWheelStraight(ranks: number[]): boolean {
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
    return uniqueRanks.length === 5 && 
           uniqueRanks[0] === CardRank.Two &&
           uniqueRanks[1] === CardRank.Three &&
           uniqueRanks[2] === CardRank.Four &&
           uniqueRanks[3] === CardRank.Five &&
           uniqueRanks[4] === CardRank.Ace;
  }

  /**
   * Arrange wheel straight cards in proper order (5-4-3-2-A)
   */
  private static arrangeWheelStraight(cards: Card[]): Card[] {
    const sorted = [...cards].sort((a, b) => {
      if (a.rank === CardRank.Ace) return 1; // Ace goes last in wheel
      if (b.rank === CardRank.Ace) return -1;
      return b.rank - a.rank;
    });
    return sorted;
  }

  /**
   * Count occurrences of each rank
   */
  private static countRanks(ranks: number[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const rank of ranks) {
      counts[rank] = (counts[rank] || 0) + 1;
    }
    return counts;
  }

  /**
   * Separate cards into primary cards and kickers based on rank counts
   */
  private static separateCardsByRank(
    cards: Card[], 
    rankCounts: Record<number, number>, 
    targetCounts: number[]
  ): { primaryCards: Card[]; kickers: Card[] } {
    const primaryCards: Card[] = [];
    const kickers: Card[] = [];

    // Sort ranks by count (highest first) then by rank (highest first)
    const sortedRanks = Object.keys(rankCounts)
      .map(Number)
      .sort((a, b) => {
        const countDiff = rankCounts[b] - rankCounts[a];
        return countDiff !== 0 ? countDiff : b - a;
      });

    let targetIndex = 0;
    
    for (const rank of sortedRanks) {
      const count = rankCounts[rank];
      const cardsOfRank = cards.filter(card => card.rank === rank);
      
      if (targetIndex < targetCounts.length && count === targetCounts[targetIndex]) {
        primaryCards.push(...cardsOfRank);
        targetIndex++;
      } else {
        kickers.push(...cardsOfRank);
      }
    }

    // Sort primary cards and kickers by rank (highest first)
    primaryCards.sort((a, b) => b.rank - a.rank);
    kickers.sort((a, b) => b.rank - a.rank);

    return { primaryCards, kickers: kickers.slice(0, 5 - primaryCards.length) };
  }

  /**
   * Create and shuffle a new deck
   */
  static createShuffledDeck(): Card[] {
    return shuffle(createDeck());
  }

  /**
   * Deal hole cards to players
   */
  static dealHoleCards(players: Player[], deck: Card[]): Card[] {
    const remainingDeck = [...deck];
    
    // Deal 2 cards to each active player
    for (let round = 0; round < 2; round++) {
      for (const player of players) {
        if (player.isActive && player.isInHand) {
          if (remainingDeck.length === 0) {
            logger.error('Not enough cards in deck to deal hole cards');
            throw new Error('Insufficient cards in deck');
          }
          player.holeCards.push(remainingDeck.shift()!);
        }
      }
    }

    return remainingDeck;
  }

  /**
   * Deal community cards for flop, turn, or river
   */
  static dealCommunityCards(deck: Card[], count: number, burnCard: boolean = true): { cards: Card[]; remainingDeck: Card[] } {
    const remainingDeck = [...deck];
    const cards: Card[] = [];

    // Burn a card if specified
    if (burnCard && remainingDeck.length > 0) {
      remainingDeck.shift();
    }

    // Deal the specified number of cards
    for (let i = 0; i < count; i++) {
      if (remainingDeck.length === 0) {
        logger.error('Not enough cards in deck to deal community cards');
        throw new Error('Insufficient cards in deck');
      }
      cards.push(remainingDeck.shift()!);
    }

    return { cards, remainingDeck };
  }

  /**
   * Determine winners of a hand
   */
  static determineWinners(players: Player[], communityCards: Card[]): { winners: Player[]; bestHand: Hand } {
    const activePlayers = players.filter(player => player.isInHand);
    
    if (activePlayers.length === 0) {
      throw new Error('No active players to determine winner');
    }

    if (activePlayers.length === 1) {
      return { 
        winners: activePlayers, 
        bestHand: this.evaluateHand([...activePlayers[0].holeCards, ...communityCards])
      };
    }

    // Evaluate hands for all active players
    const playerHands = activePlayers.map(player => ({
      player,
      hand: this.evaluateHand([...player.holeCards, ...communityCards])
    }));

    // Find the best hand
    let bestHand = playerHands[0].hand;
    for (let i = 1; i < playerHands.length; i++) {
      if (this.compareHands(playerHands[i].hand, bestHand) > 0) {
        bestHand = playerHands[i].hand;
      }
    }

    // Find all players with the best hand
    const winners = playerHands
      .filter(({ hand }) => this.compareHands(hand, bestHand) === 0)
      .map(({ player }) => player);

    return { winners, bestHand };
  }

  /**
   * Calculate pot distribution among winners
   */
  static distributePot(pot: number, winners: Player[]): number {
    if (winners.length === 0) return pot;
    
    const sharePerWinner = Math.floor(pot / winners.length);
    const remainder = pot % winners.length;

    // Award chips to winners
    for (let i = 0; i < winners.length; i++) {
      const extraChip = i < remainder ? 1 : 0;
      winners[i].chips += sharePerWinner + extraChip;
    }

    return 0; // Return remaining pot (should be 0)
  }

  /**
   * Get valid actions for a player
   */
  static getValidActions(
    player: Player, 
    gameState: GameState, 
    currentBet: number
  ): PlayerAction[] {
    const actions: PlayerAction[] = [];

    if (!player.isInHand || !player.isActive) {
      return actions;
    }

    // Can always fold
    actions.push(PlayerAction.Fold);

    const callAmount = currentBet - player.currentBet;

    // Check if player can check
    if (callAmount === 0) {
      actions.push(PlayerAction.Check);
    }

    // Check if player can call
    if (callAmount > 0 && callAmount <= player.chips) {
      actions.push(PlayerAction.Call);
    }

    // Check if player can raise
    if (player.chips > callAmount) {
      actions.push(PlayerAction.Raise);
    }

    // Can always go all-in if has chips
    if (player.chips > 0) {
      actions.push(PlayerAction.AllIn);
    }

    return actions;
  }
}