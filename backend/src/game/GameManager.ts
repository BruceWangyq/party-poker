import { 
  Room, 
  Player, 
  GameState, 
  GamePhase, 
  PlayerAction, 
  PlayerActionRequest,
  GameSettings,
  GameEvent,
  GameEventType,
  Card
} from '../types';
import { PokerEngine } from './PokerEngine';
import { 
  generatePlayerId, 
  generateRoomId, 
  getNextActivePlayerIndex,
  calculateMinRaise 
} from '../utils/helpers';
import { logGameEvent, logPlayerAction } from '../utils/logger';

export class GameManager {
  private deck: Card[] = [];

  /**
   * Start a new hand
   */
  startNewHand(room: Room): GameEvent[] {
    const events: GameEvent[] = [];
    const gameState = room.gameState;
    
    // Reset players for new hand
    room.players.forEach(player => {
      if (player.isActive) {
        player.isInHand = true;
        player.holeCards = [];
        player.currentBet = 0;
        player.totalBet = 0;
        player.lastAction = null;
      }
    });

    // Reset game state
    gameState.phase = GamePhase.PreFlop;
    gameState.communityCards = [];
    gameState.pot = 0;
    gameState.currentBet = room.settings.bigBlind;
    gameState.minRaise = room.settings.bigBlind;
    gameState.isHandActive = true;
    gameState.handNumber++;
    gameState.winners = [];

    // Create new shuffled deck
    this.deck = PokerEngine.createShuffledDeck();

    // Deal hole cards
    this.deck = PokerEngine.dealHoleCards(room.players.filter(p => p.isActive), this.deck);

    // Post blinds
    this.postBlinds(room);

    // Set first player to act (after big blind)
    gameState.currentPlayerIndex = getNextActivePlayerIndex(
      gameState.bigBlindIndex,
      room.players.length,
      (index) => room.players[index].isActive && room.players[index].isInHand
    );

    events.push({
      type: GameEventType.HandStarted,
      data: {
        handNumber: gameState.handNumber,
        dealerIndex: gameState.dealerIndex,
        blinds: {
          small: room.settings.smallBlind,
          big: room.settings.bigBlind
        }
      },
      timestamp: new Date()
    });

    logGameEvent('Hand Started', { handNumber: gameState.handNumber }, room.id);

    return events;
  }

  /**
   * Process a player action
   */
  processPlayerAction(room: Room, actionRequest: PlayerActionRequest): GameEvent[] {
    const events: GameEvent[] = [];
    const gameState = room.gameState;
    const player = room.players.find(p => p.id === actionRequest.playerId);

    if (!player || !player.isInHand || gameState.currentPlayerIndex !== room.players.indexOf(player)) {
      throw new Error('Invalid player or not player\'s turn');
    }

    const beforeChips = player.chips;

    // Process the action
    switch (actionRequest.action) {
      case PlayerAction.Fold:
        player.isInHand = false;
        player.lastAction = PlayerAction.Fold;
        break;

      case PlayerAction.Check:
        if (gameState.currentBet > player.currentBet) {
          throw new Error('Cannot check when there is a bet to call');
        }
        player.lastAction = PlayerAction.Check;
        break;

      case PlayerAction.Call:
        const callAmount = gameState.currentBet - player.currentBet;
        if (callAmount > player.chips) {
          throw new Error('Insufficient chips to call');
        }
        player.chips -= callAmount;
        player.currentBet += callAmount;
        player.totalBet += callAmount;
        gameState.pot += callAmount;
        player.lastAction = PlayerAction.Call;
        break;

      case PlayerAction.Raise:
        if (!actionRequest.amount || actionRequest.amount < gameState.minRaise) {
          throw new Error(`Minimum raise is ${gameState.minRaise}`);
        }
        const totalBet = gameState.currentBet + actionRequest.amount;
        const additionalBet = totalBet - player.currentBet;
        if (additionalBet > player.chips) {
          throw new Error('Insufficient chips to raise');
        }
        player.chips -= additionalBet;
        player.currentBet = totalBet;
        player.totalBet += additionalBet;
        gameState.pot += additionalBet;
        gameState.currentBet = totalBet;
        gameState.minRaise = actionRequest.amount;
        player.lastAction = PlayerAction.Raise;
        break;

      case PlayerAction.AllIn:
        const allInAmount = player.chips;
        player.chips = 0;
        player.currentBet += allInAmount;
        player.totalBet += allInAmount;
        gameState.pot += allInAmount;
        
        // Update current bet if this all-in is higher
        if (player.currentBet > gameState.currentBet) {
          const raiseAmount = player.currentBet - gameState.currentBet;
          gameState.currentBet = player.currentBet;
          gameState.minRaise = Math.max(gameState.minRaise, raiseAmount);
        }
        
        player.lastAction = PlayerAction.AllIn;
        break;

      default:
        throw new Error('Invalid action');
    }

    // Log the action
    logPlayerAction(
      player.id, 
      actionRequest.action, 
      room.id, 
      { 
        amount: actionRequest.amount,
        chipsUsed: beforeChips - player.chips,
        newChipCount: player.chips
      }
    );

    // Create action event
    events.push({
      type: GameEventType.PlayerAction,
      data: {
        playerId: player.id,
        action: actionRequest.action,
        amount: actionRequest.amount,
        chipsUsed: beforeChips - player.chips,
        pot: gameState.pot
      },
      timestamp: new Date()
    });

    // Check if hand should advance
    if (this.shouldAdvanceHand(room)) {
      events.push(...this.advanceHand(room));
    } else {
      // Move to next player
      gameState.currentPlayerIndex = getNextActivePlayerIndex(
        gameState.currentPlayerIndex,
        room.players.length,
        (index) => room.players[index].isActive && room.players[index].isInHand
      );
    }

    return events;
  }

  /**
   * Check if betting round is complete and hand should advance
   */
  private shouldAdvanceHand(room: Room): boolean {
    const activePlayers = room.players.filter(p => p.isInHand);
    
    // If only one player left, go to showdown
    if (activePlayers.length <= 1) {
      return true;
    }

    // If all players are all-in, advance to showdown
    const playersWithChips = activePlayers.filter(p => p.chips > 0);
    if (playersWithChips.length <= 1) {
      return true;
    }

    // Check if all active players have acted and matched the current bet
    for (const player of activePlayers) {
      if (player.chips > 0 && (player.lastAction === null || player.currentBet < room.gameState.currentBet)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Advance to the next phase of the hand
   */
  private advanceHand(room: Room): GameEvent[] {
    const events: GameEvent[] = [];
    const gameState = room.gameState;

    // Reset player actions for new round
    room.players.forEach(player => {
      if (player.isInHand) {
        player.lastAction = null;
      }
    });

    gameState.currentBet = 0;
    gameState.minRaise = room.settings.bigBlind;

    switch (gameState.phase) {
      case GamePhase.PreFlop:
        gameState.phase = GamePhase.Flop;
        const flopResult = PokerEngine.dealCommunityCards(this.deck, 3, true);
        gameState.communityCards.push(...flopResult.cards);
        this.deck = flopResult.remainingDeck;
        
        events.push({
          type: GameEventType.CardsDealt,
          data: { phase: 'flop', cards: flopResult.cards },
          timestamp: new Date()
        });
        break;

      case GamePhase.Flop:
        gameState.phase = GamePhase.Turn;
        const turnResult = PokerEngine.dealCommunityCards(this.deck, 1, true);
        gameState.communityCards.push(...turnResult.cards);
        this.deck = turnResult.remainingDeck;
        
        events.push({
          type: GameEventType.CardsDealt,
          data: { phase: 'turn', cards: turnResult.cards },
          timestamp: new Date()
        });
        break;

      case GamePhase.Turn:
        gameState.phase = GamePhase.River;
        const riverResult = PokerEngine.dealCommunityCards(this.deck, 1, true);
        gameState.communityCards.push(...riverResult.cards);
        this.deck = riverResult.remainingDeck;
        
        events.push({
          type: GameEventType.CardsDealt,
          data: { phase: 'river', cards: riverResult.cards },
          timestamp: new Date()
        });
        break;

      case GamePhase.River:
        gameState.phase = GamePhase.Showdown;
        events.push(...this.processShowdown(room));
        return events;

      default:
        break;
    }

    // Set next player to act (first active player after dealer)
    if (gameState.phase !== GamePhase.Showdown) {
      gameState.currentPlayerIndex = getNextActivePlayerIndex(
        gameState.dealerIndex,
        room.players.length,
        (index) => room.players[index].isActive && room.players[index].isInHand && room.players[index].chips > 0
      );

      events.push({
        type: GameEventType.PhaseChanged,
        data: { 
          phase: gameState.phase,
          currentPlayerIndex: gameState.currentPlayerIndex
        },
        timestamp: new Date()
      });
    }

    return events;
  }

  /**
   * Process showdown and determine winners
   */
  private processShowdown(room: Room): GameEvent[] {
    const events: GameEvent[] = [];
    const gameState = room.gameState;
    
    const { winners, bestHand } = PokerEngine.determineWinners(
      room.players,
      gameState.communityCards
    );

    gameState.winners = winners.map(w => w.id);

    // Distribute pot
    const remainingPot = PokerEngine.distributePot(gameState.pot, winners);
    gameState.pot = remainingPot;

    events.push({
      type: GameEventType.WinnerDetermined,
      data: {
        winners: winners.map(w => ({
          id: w.id,
          nickname: w.nickname,
          hand: bestHand,
          holeCards: w.holeCards
        })),
        bestHand,
        potAwarded: gameState.pot
      },
      timestamp: new Date()
    });

    // Move to hand complete
    gameState.phase = GamePhase.HandComplete;
    gameState.isHandActive = false;

    events.push({
      type: GameEventType.HandEnded,
      data: { handNumber: gameState.handNumber },
      timestamp: new Date()
    });

    logGameEvent('Hand Completed', { 
      handNumber: gameState.handNumber,
      winners: winners.map(w => w.nickname)
    }, room.id);

    return events;
  }

  /**
   * Post small and big blinds
   */
  private postBlinds(room: Room): void {
    const gameState = room.gameState;
    const players = room.players;

    // Post small blind
    if (gameState.smallBlindIndex < players.length && players[gameState.smallBlindIndex].isActive) {
      const smallBlindPlayer = players[gameState.smallBlindIndex];
      const blindAmount = Math.min(room.settings.smallBlind, smallBlindPlayer.chips);
      
      smallBlindPlayer.chips -= blindAmount;
      smallBlindPlayer.currentBet = blindAmount;
      smallBlindPlayer.totalBet = blindAmount;
      smallBlindPlayer.isSmallBlind = true;
      gameState.pot += blindAmount;
    }

    // Post big blind
    if (gameState.bigBlindIndex < players.length && players[gameState.bigBlindIndex].isActive) {
      const bigBlindPlayer = players[gameState.bigBlindIndex];
      const blindAmount = Math.min(room.settings.bigBlind, bigBlindPlayer.chips);
      
      bigBlindPlayer.chips -= blindAmount;
      bigBlindPlayer.currentBet = blindAmount;
      bigBlindPlayer.totalBet = blindAmount;
      bigBlindPlayer.isBigBlind = true;
      gameState.pot += blindAmount;
    }
  }

  /**
   * Prepare for next hand
   */
  prepareNextHand(room: Room): void {
    const gameState = room.gameState;
    const activePlayers = room.players.filter(p => p.isActive);

    // Move dealer button
    gameState.dealerIndex = getNextActivePlayerIndex(
      gameState.dealerIndex,
      room.players.length,
      (index) => room.players[index].isActive
    );

    // Set blind positions
    if (activePlayers.length === 2) {
      // Heads-up: dealer is small blind
      gameState.smallBlindIndex = gameState.dealerIndex;
      gameState.bigBlindIndex = getNextActivePlayerIndex(
        gameState.dealerIndex,
        room.players.length,
        (index) => room.players[index].isActive
      );
    } else {
      // More than 2 players: normal blind structure
      gameState.smallBlindIndex = getNextActivePlayerIndex(
        gameState.dealerIndex,
        room.players.length,
        (index) => room.players[index].isActive
      );
      gameState.bigBlindIndex = getNextActivePlayerIndex(
        gameState.smallBlindIndex,
        room.players.length,
        (index) => room.players[index].isActive
      );
    }

    // Reset player states
    room.players.forEach(player => {
      player.isDealer = false;
      player.isSmallBlind = false;
      player.isBigBlind = false;
      player.currentBet = 0;
      player.totalBet = 0;
      player.lastAction = null;
      player.holeCards = [];
      player.isInHand = player.isActive;
    });

    // Set dealer flag
    if (gameState.dealerIndex < room.players.length) {
      room.players[gameState.dealerIndex].isDealer = true;
    }
  }

  /**
   * Get valid actions for current player
   */
  getValidActions(room: Room): PlayerAction[] {
    const gameState = room.gameState;
    const currentPlayer = room.players[gameState.currentPlayerIndex];
    
    if (!currentPlayer) {
      return [];
    }

    return PokerEngine.getValidActions(currentPlayer, gameState, gameState.currentBet);
  }

  /**
   * Check if game can start
   */
  canStartGame(room: Room): boolean {
    const activePlayers = room.players.filter(p => p.isActive);
    return activePlayers.length >= room.settings.minPlayers;
  }

  /**
   * Initialize game state for a new game
   */
  initializeGame(room: Room): void {
    const gameState = room.gameState;
    const activePlayers = room.players.filter(p => p.isActive);

    if (activePlayers.length < 2) {
      throw new Error('Need at least 2 players to start game');
    }

    // Set initial dealer (random)
    gameState.dealerIndex = Math.floor(Math.random() * activePlayers.length);
    
    // Initialize positions
    this.prepareNextHand(room);
    
    // Reset hand number
    gameState.handNumber = 0;
    gameState.phase = GamePhase.Waiting;
    gameState.isHandActive = false;

    logGameEvent('Game Initialized', { playerCount: activePlayers.length }, room.id);
  }
}