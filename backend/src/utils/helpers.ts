import { v4 as uuidv4 } from 'uuid';
import { Card, CardRank, CardSuit } from '../types';

/**
 * Generate a unique 6-character room code
 */
export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate a unique player ID
 */
export const generatePlayerId = (): string => {
  return uuidv4();
};

/**
 * Generate a unique room ID
 */
export const generateRoomId = (): string => {
  return uuidv4();
};

/**
 * Create a standard 52-card deck
 */
export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  
  for (const suit of Object.values(CardSuit)) {
    for (let rank = CardRank.Two; rank <= CardRank.Ace; rank++) {
      deck.push({ rank, suit });
    }
  }
  
  return deck;
};

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export const shuffle = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Get the string representation of a card rank
 */
export const getRankString = (rank: CardRank): string => {
  switch (rank) {
    case CardRank.Two: return '2';
    case CardRank.Three: return '3';
    case CardRank.Four: return '4';
    case CardRank.Five: return '5';
    case CardRank.Six: return '6';
    case CardRank.Seven: return '7';
    case CardRank.Eight: return '8';
    case CardRank.Nine: return '9';
    case CardRank.Ten: return '10';
    case CardRank.Jack: return 'J';
    case CardRank.Queen: return 'Q';
    case CardRank.King: return 'K';
    case CardRank.Ace: return 'A';
    default: return '?';
  }
};

/**
 * Get the symbol representation of a card suit
 */
export const getSuitSymbol = (suit: CardSuit): string => {
  switch (suit) {
    case CardSuit.Hearts: return '♥';
    case CardSuit.Diamonds: return '♦';
    case CardSuit.Clubs: return '♣';
    case CardSuit.Spades: return '♠';
    default: return '?';
  }
};

/**
 * Get a human-readable string representation of a card
 */
export const getCardString = (card: Card): string => {
  return `${getRankString(card.rank)}${getSuitSymbol(card.suit)}`;
};

/**
 * Get the next active player index in a circular manner
 */
export const getNextActivePlayerIndex = (
  currentIndex: number,
  playerCount: number,
  isActiveCallback: (index: number) => boolean
): number => {
  let nextIndex = (currentIndex + 1) % playerCount;
  let attempts = 0;
  
  while (!isActiveCallback(nextIndex) && attempts < playerCount) {
    nextIndex = (nextIndex + 1) % playerCount;
    attempts++;
  }
  
  return attempts < playerCount ? nextIndex : currentIndex;
};

/**
 * Calculate the minimum raise amount
 */
export const calculateMinRaise = (currentBet: number, lastRaise: number, bigBlind: number): number => {
  return Math.max(lastRaise, bigBlind);
};

/**
 * Format chip amount for display
 */
export const formatChips = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
};

/**
 * Calculate percentage with precision
 */
export const calculatePercentage = (part: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((part / total) * 100 * 100) / 100;
};

/**
 * Validate room code format
 */
export const isValidRoomCode = (code: string): boolean => {
  return /^[A-Z0-9]{6}$/.test(code);
};

/**
 * Validate nickname format
 */
export const isValidNickname = (nickname: string): boolean => {
  return /^[a-zA-Z0-9_-]{2,20}$/.test(nickname);
};

/**
 * Generate a random delay for simulating network latency in development
 */
export const randomDelay = (min: number = 100, max: number = 500): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    return Promise.resolve();
  }
  
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Sanitize user input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 1000); // Limit length
};

/**
 * Generate a random integer between min and max (inclusive)
 */
export const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Check if a room is expired
 */
export const isRoomExpired = (lastActivity: Date, expiryHours: number = 24): boolean => {
  const now = new Date();
  const expiryTime = new Date(lastActivity.getTime() + (expiryHours * 60 * 60 * 1000));
  return now > expiryTime;
};

/**
 * Format timestamp for logging
 */
export const formatTimestamp = (date: Date = new Date()): string => {
  return date.toISOString();
};

/**
 * Convert milliseconds to human-readable duration
 */
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};