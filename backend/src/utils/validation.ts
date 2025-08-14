import Joi from 'joi';
import { RoomCreateRequest, RoomJoinRequest, PlayerActionRequest, PlayerAction } from '../types';

// Room validation schemas
export const roomCreateSchema = Joi.object<RoomCreateRequest>({
  hostNickname: Joi.string()
    .min(2)
    .max(20)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
      'string.min': 'Nickname must be at least 2 characters',
      'string.max': 'Nickname must be at most 20 characters',
      'string.pattern.base': 'Nickname can only contain letters, numbers, underscores, and hyphens'
    }),
  settings: Joi.object({
    smallBlind: Joi.number().min(1).max(1000).optional(),
    bigBlind: Joi.number().min(2).max(2000).optional(),
    startingChips: Joi.number().min(100).max(100000).optional(),
    maxPlayers: Joi.number().min(2).max(8).optional(),
    minPlayers: Joi.number().min(2).max(8).optional(),
    timeLimit: Joi.number().min(30).max(300).optional()
  }).optional()
});

export const roomJoinSchema = Joi.object<RoomJoinRequest>({
  roomCode: Joi.string()
    .length(6)
    .pattern(/^[A-Z0-9]+$/)
    .required()
    .messages({
      'string.length': 'Room code must be exactly 6 characters',
      'string.pattern.base': 'Room code must contain only uppercase letters and numbers'
    }),
  nickname: Joi.string()
    .min(2)
    .max(20)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
      'string.min': 'Nickname must be at least 2 characters',
      'string.max': 'Nickname must be at most 20 characters',
      'string.pattern.base': 'Nickname can only contain letters, numbers, underscores, and hyphens'
    })
});

export const playerActionSchema = Joi.object<PlayerActionRequest>({
  playerId: Joi.string().uuid().required(),
  action: Joi.string()
    .valid(...Object.values(PlayerAction))
    .required(),
  amount: Joi.number().min(0).when('action', {
    is: PlayerAction.Raise,
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

// Validation helper functions
export const validateRoomCreate = (data: any): { error?: string; value?: RoomCreateRequest } => {
  const { error, value } = roomCreateSchema.validate(data);
  if (error) {
    return { error: error.details[0].message };
  }
  return { value };
};

export const validateRoomJoin = (data: any): { error?: string; value?: RoomJoinRequest } => {
  const { error, value } = roomJoinSchema.validate(data);
  if (error) {
    return { error: error.details[0].message };
  }
  return { value };
};

export const validatePlayerAction = (data: any): { error?: string; value?: PlayerActionRequest } => {
  const { error, value } = playerActionSchema.validate(data);
  if (error) {
    return { error: error.details[0].message };
  }
  return { value };
};

// Business logic validations
export const validateGameAction = (
  action: PlayerActionRequest,
  playerId: string,
  currentBet: number,
  playerChips: number,
  playerCurrentBet: number
): { valid: boolean; error?: string } => {
  // Check if it's the player's turn
  if (action.playerId !== playerId) {
    return { valid: false, error: 'Not your turn' };
  }

  switch (action.action) {
    case PlayerAction.Fold:
    case PlayerAction.Check:
      return { valid: true };

    case PlayerAction.Call:
      const callAmount = currentBet - playerCurrentBet;
      if (callAmount > playerChips) {
        return { valid: false, error: 'Insufficient chips to call' };
      }
      return { valid: true };

    case PlayerAction.Raise:
      if (!action.amount || action.amount <= 0) {
        return { valid: false, error: 'Raise amount must be positive' };
      }
      const totalBet = currentBet + action.amount;
      const additionalBet = totalBet - playerCurrentBet;
      if (additionalBet > playerChips) {
        return { valid: false, error: 'Insufficient chips to raise' };
      }
      return { valid: true };

    case PlayerAction.AllIn:
      if (playerChips <= 0) {
        return { valid: false, error: 'No chips to go all-in' };
      }
      return { valid: true };

    default:
      return { valid: false, error: 'Invalid action' };
  }
};

export const validateRoomSettings = (settings: any): { valid: boolean; error?: string } => {
  if (settings.bigBlind && settings.smallBlind && settings.bigBlind <= settings.smallBlind) {
    return { valid: false, error: 'Big blind must be greater than small blind' };
  }

  if (settings.maxPlayers && settings.minPlayers && settings.maxPlayers < settings.minPlayers) {
    return { valid: false, error: 'Max players must be greater than or equal to min players' };
  }

  return { valid: true };
};