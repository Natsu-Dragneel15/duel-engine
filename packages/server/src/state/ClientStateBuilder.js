/**
 * ClientStateBuilder
 * Builds the sanitized state object sent to each client via state_update.
 * Each player gets a personalized view (me vs opponent).
 * Clients NEVER receive raw room state.
 */

class ClientStateBuilder {
  constructor(ruleEngine) {
    this.rules = ruleEngine;
  }

  build(room, playerId, timers) {
    const opponentId = room.playerOrder.find(id => id !== playerId);
    const me  = room.players[playerId];
    const opp = opponentId ? room.players[opponentId] : null;
    const now = Date.now();

    return {
      phase:       room.phase,
      presetName:  room.presetName,
      settings:    room.settings,
      isOwner:     room.ownerId === playerId,

      me:       me  ? this._sanitizePlayer(me,  playerId,  room, timers, now) : null,
      opponent: opp ? this._sanitizePlayer(opp, opponentId, room, timers, now) : null,

      // Turn state
      currentAttackerId: room.currentAttacker || null,
      isMyTurn:        room.currentAttacker === playerId,
      pendingDefense: room.pendingDefense && playerId !== room.currentAttacker,

      // Round & match
      currentRound: room.currentRound,
      bestOf:       room.settings.bestOf,
      winsRequired: this.rules.getWinsRequired(room.settings.bestOf),
      roundScores:  room.roundScores,
      matchWinner:  room.matchWinner,
      winner:       room.winner,

      // P availability
      pRollAvailable: this._isPRollAvailable(room, playerId),

      // HYPNO
      hypnoSkipsRemaining:    room.hypnoState[playerId]    || 0,
      oppHypnoSkipsRemaining: room.hypnoState[opponentId]  || 0,

      // Log
      battleLog: room.battleLog.slice(-50),

      // Timing
      startedAt:        room.startedAt,
      matchDuration:    room.startedAt ? now - room.startedAt : 0,
      cooldownRemaining: timers ? timers.getCooldownRemaining(playerId) : 0,

      // Initiative
      initiativeRolls: room.initiativeRolls,

      // Abilities available to me (from preset)
      abilities: this.rules.getAbilitiesForRole(me?.role || '').map(a => ({
        id:          a.id,
        label:       a.label,
        icon:        a.icon,
        usesLeft:    (a.usesPerMatch || 1) - (me?.abilityUses?.[a.id] || 0),
        requiresRoll: a.requiresRoll
      }))
    };
  }

  _sanitizePlayer(player, playerId, room, timers, now) {
    return {
      name:       player.name,
      role:       player.role,
      hp:         player.hp,
      maxHp:      player.maxHp,
      status:     player.status,
      protection: player.protection,
      ready:      player.ready,
      connected:  player.connected,
      pStatus:    player.pStatus,
      stats:      player.stats,
      abilityUses: player.abilityUses,
      cooldownEnd: room.cooldownEnd?.[playerId] || 0,
      hypnoSkipsRemaining: room.hypnoState?.[playerId] || 0
    };
  }

  _isPRollAvailable(room, playerId) {
    if (room.phase !== 'ended') return false;
    if (!room.matchWinner) return false;
    const me = room.players[playerId];
    if (!me || me.role !== 'attacker') return false;
    if (me.pAttempted) return false;
    if (room.matchWinner !== me.name) return false;
    if (!room.defenderMBInFinalRound) return false;
    const defId = room.playerOrder.find(pid => room.players[pid]?.role === 'defender');
    return defId ? !room.players[defId]?.protection : false;
  }
}

module.exports = ClientStateBuilder;
