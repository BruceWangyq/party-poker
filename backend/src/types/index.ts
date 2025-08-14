export interface Card {
  rank: CardRank;
  suit: CardSuit;
}

export enum CardRank {
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14
}

export enum CardSuit {
  Hearts = 'hearts',
  Diamonds = 'diamonds',
  Clubs = 'clubs',
  Spades = 'spades'
}

export enum HandRank {
  HighCard = 1,
  Pair = 2,
  TwoPair = 3,
  ThreeOfAKind = 4,
  Straight = 5,
  Flush = 6,
  FullHouse = 7,
  FourOfAKind = 8,
  StraightFlush = 9,
  RoyalFlush = 10
}

export interface Hand {
  rank: HandRank;
  cards: Card[];
  kickers: Card[];
  description: string;
}

export enum GamePhase {
  Waiting = 'waiting',
  PreFlop = 'preFlop',
  Flop = 'flop',
  Turn = 'turn',
  River = 'river',
  Showdown = 'showdown',
  HandComplete = 'handComplete'
}

export enum PlayerAction {
  Fold = 'fold',
  Check = 'check',
  Call = 'call',
  Raise = 'raise',
  AllIn = 'allIn'
}

export interface Player {
  id: string;
  nickname: string;
  chips: number;
  holeCards: Card[];
  position: number;
  isActive: boolean;
  isInHand: boolean;
  currentBet: number;
  totalBet: number;
  lastAction: PlayerAction | null;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  hasFolded: boolean;
  isAllIn: boolean;
  socketId?: string;
}

export interface GameSettings {
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  maxPlayers: number;
  minPlayers: number;
  timeLimit?: number;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  gameState: GameState;
  settings: GameSettings;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface GameState {
  phase: GamePhase;
  communityCards: Card[];
  pot: number;
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentBet: number;
  minRaise: number;
  isHandActive: boolean;
  handNumber: number;
  winners: string[];
  players: Player[];
}

export interface PlayerActionRequest {
  playerId: string;
  action: PlayerAction;
  amount?: number;
}

export interface RoomCreateRequest {
  hostNickname: string;
  settings?: Partial<GameSettings>;
}

export interface RoomJoinRequest {
  roomCode: string;
  nickname: string;
}

export interface GameEvent {
  type: GameEventType;
  data: any;
  timestamp: Date;
}

export enum GameEventType {
  PlayerJoined = 'playerJoined',
  PlayerLeft = 'playerLeft',
  GameStarted = 'gameStarted',
  GameEnded = 'gameEnded',
  HandStarted = 'handStarted',
  HandEnded = 'handEnded',
  PlayerAction = 'playerAction',
  CardsDealt = 'cardsDealt',
  PhaseChanged = 'phaseChanged',
  WinnerDetermined = 'winnerDetermined',
  ChipsAwarded = 'chipsAwarded'
}

export interface SocketEvents {
  // Client to Server
  'room:create': (data: RoomCreateRequest) => void;
  'room:join': (data: RoomJoinRequest) => void;
  'room:leave': () => void;
  'game:start': () => void;
  'game:action': (data: PlayerActionRequest) => void;
  'ping': () => void;

  // Server to Client
  'room:created': (data: { room: Room; playerId: string }) => void;
  'room:joined': (data: { room: Room; playerId: string }) => void;
  'room:updated': (room: Room) => void;
  'room:error': (error: string) => void;
  'game:updated': (gameState: GameState) => void;
  'game:event': (event: GameEvent) => void;
  'player:turn': (playerId: string) => void;
  'error': (error: string) => void;
  'pong': () => void;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface RoomStats {
  totalRooms: number;
  activeRooms: number;
  totalPlayers: number;
  activePlayers: number;
}