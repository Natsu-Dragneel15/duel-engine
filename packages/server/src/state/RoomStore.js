/**
 * RoomStore
 * In-memory store for all active rooms.
 * Single source of truth for live game state.
 * Interface designed to swap to Redis later without changing callers.
 */

const { generateRoomCode } = require('@duel-engine/shared');

class RoomStore {
  constructor() {
    this._rooms = new Map(); // code → Room
  }

  /** Create and store a new room. Returns the room object. */
  create(presetConfig, settings = {}) {
    let code;
    do { code = generateRoomCode(); } while (this._rooms.has(code));

    const room = {
      code,
      presetName: presetConfig.meta?.name || 'Unknown',
      settings: {
        bestOf:            settings.bestOf || 1,
        protectionEnabled: settings.protectionEnabled !== false,
        diceFaces:         settings.diceFaces || presetConfig.dice?.defaultFaces || 6,
        startingHp:        settings.startingHp || presetConfig.players?.startingHp || 100,
        damage:            settings.damage || presetConfig.combat?.damage || 25,
        cooldownSeconds: parseInt(settings.cooldownSeconds) || parseInt(presetConfig.combat?.attackCooldownSeconds) || 120,
        prize:             settings.prize || ''
      },
      phase:         'lobby',
      players:       {},      // socketId → PlayerState
      playerOrder:   [],      // [socketId, socketId]
      ownerId:       null,    // defender is always the room owner
      currentRound:  1,
      roundScores:   {},      // playerName → wins
      matchWinner:   null,
      defenderMBInFinalRound: false,
      winner:        null,    // current round winner
      initiativeRolls: {},
      pendingDefense:  false,
      pendingAttack:   null,
      cooldownEnd:     {},    // socketId → timestamp
      hypnoState:      {},    // defenderId → skipsRemaining
      bcTimers:        {},
      protectionDrainTimer: null,
      bcBrokenProtection: false,
      battleLog:     [],
      startedAt:     null,
      endedAt:       null,
      disconnectTimers: {}
    };

    this._rooms.set(code, room);
    return room;
  }

  get(code) {
    return this._rooms.get(code) || null;
  }

  delete(code) {
    this._rooms.delete(code);
  }

  has(code) {
    return this._rooms.has(code);
  }

  /** Find the room a socket is currently in */
  findBySocket(socketId) {
    for (const [code, room] of this._rooms) {
      if (room.players[socketId]) return { code, room };
    }
    return null;
  }

  size() {
    return this._rooms.size;
  }
}

// Export a singleton — one store for the whole server process
module.exports = new RoomStore();
