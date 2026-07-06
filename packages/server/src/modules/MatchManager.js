/**
 * MatchManager
 * Coordinates all game modules for one active match.
 * One instance per room. Created when a match starts.
 *
 * Responsibilities:
 *   - Orchestrate module calls in the correct order
 *   - Return structured results the socket server broadcasts
 *   - Never talk to sockets directly
 *   - Never make rule decisions itself — always asks RuleEngine
 */

const DiceEngine          = require('./DiceEngine');
const HpEngine            = require('./HpEngine');
const BattleLog           = require('./BattleLog');
const StatsTracker        = require('./StatsTracker');
const TimerEngine         = require('./TimerEngine');
const TurnManager         = require('./TurnManager');
const { resetPlayerForRound } = require('../state/PlayerFactory');
const { LOG_TYPES }       = require('@duel-engine/shared');

class MatchManager {
  constructor(room, ruleEngine) {
    this.room    = room;
    this.rules   = ruleEngine;
    this.dice    = new DiceEngine(ruleEngine);
    this.hp      = new HpEngine(ruleEngine);
    this.log     = new BattleLog();
    this.stats   = new StatsTracker();
    this.timers  = new TimerEngine(ruleEngine);
    this.turns   = new TurnManager(ruleEngine);

    // Sync log to room so ClientStateBuilder can access it
    this.room.battleLog = this.log.entries;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  _getOpponentId(socketId) {
    return this.room.playerOrder.find(id => id !== socketId);
  }

  _getPlayer(socketId) {
    return this.room.players[socketId];
  }

  _getOpponent(socketId) {
    return this.room.players[this._getOpponentId(socketId)];
  }

  _applyDamageAndLog(targetId, amount, source) {
    const target = this._getPlayer(targetId);
    if (!target) return 0;
    const result = this.hp.applyDamage(target, amount);

    if (result.statusChanged) {
      this.stats.recordStatusChange(targetId);
      this.log.add(LOG_TYPES.STATUS_CHANGE,
        `📊 ${target.name}: ${result.oldStatus} → ${result.newStatus}`,
        { player: target.name, from: result.oldStatus, to: result.newStatus }
      );
    }
    return result.damage;
  }

  _checkDefeat(targetId) {
    const target = this._getPlayer(targetId);
    return target && this.hp.isDefeated(target);
  }

  // ─── Match Start ────────────────────────────────────────────────────────────

  startMatch() {
    this.room.phase    = 'initiative';
    this.room.startedAt = Date.now();

    // Init stats for all players
    this.room.playerOrder.forEach(pid => this.stats.init(pid));

    this.log.add(LOG_TYPES.MATCH_START, '⚔️ The battle begins! Roll initiative!');

    // Start protection drain if protection OFF at start
    if (!this.room.settings.protectionEnabled) {
      const dot = this.rules.getDoTSystem('protection_drain');
      if (dot) {
        this.timers.startDoT('protection_drain',
          dot.intervalMinutes * 60 * 1000,
          () => this._tickProtectionDrain(dot)
        );
      }
    }

    return { ok: true };
  }

  _tickProtectionDrain(dot) {
    // Damage all players simultaneously
    this.room.playerOrder.forEach(pid => {
      const dmg = this._applyDamageAndLog(pid, dot.damagePerTick, 'protection_drain');
      if (dmg > 0) {
        this.log.add(LOG_TYPES.DOT_DAMAGE,
          dot.message
            .replace('{target}', this.room.players[pid]?.name)
            .replace('{damage}', dmg)
        );
      }
    });
    this._checkAllDefeats();
  }

  // ─── Initiative ─────────────────────────────────────────────────────────────

  rollInitiative(socketId) {
    if (this.room.phase !== 'initiative') return { ok: false, error: 'Not initiative phase' };
    if (this.room.initiativeRolls[socketId] !== undefined) return { ok: false, error: 'Already rolled' };

    const player = this._getPlayer(socketId);
    const rollResult = this.dice.rollForPlayer(player);
    this.room.initiativeRolls[socketId] = rollResult.final;
    this.stats.recordRoll(socketId, rollResult.final);

    this.log.add(LOG_TYPES.INITIATIVE,
      this.dice.formatRollMessage(player.name, rollResult, 'initiative'),
      { player: player.name, roll: rollResult.final, raw: rollResult.raw, penalty: rollResult.penalty }
    );

    if (this.room.playerOrder.every(pid => this.room.initiativeRolls[pid] !== undefined)) {
      return this._resolveInitiative();
    }

    return { ok: true };
  }

  _resolveInitiative() {
    const playerIds = this.room.playerOrder;
    const rolls = playerIds.map(id => this.room.initiativeRolls[id]);
    const isTie = rolls.every(r => r === rolls[0]);

    if (isTie) {
      // Clear ONLY room.initiativeRolls — that's the only source of truth
      this.room.initiativeRolls = {};
      this.log.add(LOG_TYPES.INITIATIVE_TIE, '🔁 Tie! Both players reroll initiative.');
      return { ok: true, tie: true };
    }

    const winnerId = playerIds.reduce((best, id) =>
      (this.room.initiativeRolls[id] > this.room.initiativeRolls[best] ? id : best)
    , playerIds[0]);

    this.room.currentAttacker = winnerId;
    this.turns.currentAttackerId = winnerId;
    this.room.phase = 'battle';

    const winnerName = this._getPlayer(winnerId).name;
    this.log.add(LOG_TYPES.INITIATIVE_RESULT,
      `⚔️ ${winnerName} goes first!`,
      { winner: winnerName }
    );

    return { ok: true, firstAttacker: winnerId };
  }

  // ─── Attack ─────────────────────────────────────────────────────────────────

  attack(socketId, abilityId = null) {
    if (this.room.phase !== 'battle') return { ok: false, error: 'Not in battle' };
    if (this.room.currentAttacker !== socketId) return { ok: false, error: 'Not your turn' };
    if (this.room.pendingDefense) return { ok: false, error: 'Defense pending' };
    if (this.timers.isOnCooldown(socketId)) {
      return { ok: false, error: `Cooldown: ${Math.ceil(this.timers.getCooldownRemaining(socketId) / 1000)}s remaining` };
    }

    const attacker = this._getPlayer(socketId);
    const defenderId = this._getOpponentId(socketId);
    const defender  = this._getPlayer(defenderId);

    // ── Ability attack ────────────────────────────────────────────────────────
    if (abilityId) {
      const check = this.rules.canUseAbility(abilityId, {
        player: attacker, opponent: defender,
        phase: this.room.phase
      });
      if (!check.allowed) return { ok: false, error: check.reason };

      // Mark ability as used
      attacker.abilityUses[abilityId] = (attacker.abilityUses[abilityId] || 0) + 1;
      this.stats.recordAbilityUse(socketId, abilityId);

      const { roll, success } = this.dice.rollForAbility(abilityId);
      const ability = this.rules.getAbility(abilityId);

      this.log.add(LOG_TYPES.ABILITY_USE,
        `⚡ ${attacker.name} uses ${ability.label}! Rolled ${roll}${success ? ' — SUCCESS!' : ' — failed'}`,
        { player: attacker.name, abilityId, roll, success }
      );

      if (success) {
        return this._applyAbilityEffect(abilityId, ability, socketId, defenderId, roll);
      } else {
        this.log.add(LOG_TYPES.ABILITY_FAIL,
          `${ability.icon} ${ability.label} failed.`,
          { abilityId, roll }
        );
        this.timers.setCooldown(socketId, (this.room.settings.cooldownSeconds * 1000));
        this._passTurn();
        return { ok: true };
      }
    }

    // ── Normal attack ─────────────────────────────────────────────────────────
    const rollResult = this.dice.rollForPlayer(attacker);
    this.stats.recordRoll(socketId, rollResult.final);
    this.stats.recordAttack(socketId);

    this.log.add(LOG_TYPES.ATTACK_ROLL,
      this.dice.formatRollMessage(attacker.name, rollResult, 'attack'),
      { player: attacker.name, roll: rollResult.final, raw: rollResult.raw, penalty: rollResult.penalty }
    );

    // Check if HYPNO skips apply
    const hypnoSkips = this.room.hypnoState[defenderId] || 0;
    if (hypnoSkips > 0) {
      return this._applyHypnoHit(socketId, defenderId, rollResult);
    }

    // Normal flow: request defense
    this.room.pendingDefense = true;
    this.room.pendingAttack  = { attackerId: socketId, roll: rollResult.final };
    return { ok: true, pendingDefense: true };
  }

  _applyHypnoHit(attackerId, defenderId, rollResult) {
    const attacker = this._getPlayer(attackerId);
    const defender = this._getPlayer(defenderId);

    this.room.hypnoState[defenderId] = (this.room.hypnoState[defenderId] || 1) - 1;
    const skipsLeft = this.room.hypnoState[defenderId];
    const skipNum   = 3 - skipsLeft - 1;

    const dmg = this._applyDamageAndLog(defenderId, this.rules.getDamage(), 'hypno_hit');
    this.stats.recordHit(attackerId, defenderId, dmg);
    this.stats.recordAttack(attackerId);

    this.log.add(LOG_TYPES.HIT,
      `🌀 HYPNO — Defense skipped! ${attacker.name} automatically hits ${defender.name} for ${dmg} damage.${skipsLeft === 0 ? ' HYPNO expired.' : ''}`,
      { attacker: attacker.name, defender: defender.name, damage: dmg, skipsLeft, hypno: true }
    );

    if (this._checkAllDefeats()) return { ok: true };
    this.timers.setCooldown(attackerId, (this.room.settings.cooldownSeconds * 1000));
    this._passTurn();
    return { ok: true };
  }

  // ─── Defense ────────────────────────────────────────────────────────────────

  defend(socketId) {
    if (!this.room.pendingDefense) return { ok: false, error: 'No pending defense' };
    const attackerId = this.room.pendingAttack?.attackerId;
    if (socketId !== this._getOpponentId(attackerId)) return { ok: false, error: 'Not your defense' };

    const defender = this._getPlayer(socketId);
    const attacker = this._getPlayer(attackerId);
    const atkRoll  = this.room.pendingAttack.roll;

    const defRollResult = this.dice.rollForPlayer(defender);
    this.stats.recordRoll(socketId, defRollResult.final);

    this.log.add(LOG_TYPES.DEFENSE_ROLL,
      this.dice.formatRollMessage(defender.name, defRollResult, 'defense'),
      { player: defender.name, roll: defRollResult.final, raw: defRollResult.raw, penalty: defRollResult.penalty }
    );

    this.room.pendingDefense = false;
    this.room.pendingAttack  = null;

    const outcome = this.rules.resolveAttack(atkRoll, defRollResult.final);

    if (outcome === 'hit') {
      const dmg = this._applyDamageAndLog(socketId, this.rules.getDamage(), 'attack');
      this.stats.recordHit(attackerId, socketId, dmg);
      this.stats.recordAttack(attackerId);

      this.log.add(LOG_TYPES.HIT,
        `💥 HIT! ${attacker.name} (${atkRoll}) beat ${defender.name} (${defRollResult.final}) for ${dmg} damage!`,
        { attacker: attacker.name, defender: defender.name, attackRoll: atkRoll, defenseRoll: defRollResult.final, damage: dmg }
      );

      if (this._checkAllDefeats()) return { ok: true };
    } else {
      this.stats.recordMiss(attackerId);
      this.log.add(LOG_TYPES.MISS,
        `🛡️ BLOCKED! ${defender.name} (${defRollResult.final}) stopped ${attacker.name} (${atkRoll})`,
        { attacker: attacker.name, defender: defender.name, attackRoll: atkRoll, defenseRoll: defRollResult.final }
      );
    }

    this.timers.setCooldown(attackerId, (this.room.settings.cooldownSeconds * 1000));
    this._passTurn();
    return { ok: true };
  }

  // ─── Abilities ───────────────────────────────────────────────────────────────

  _applyAbilityEffect(abilityId, ability, attackerId, defenderId, roll) {
    const attacker = this._getPlayer(attackerId);
    const defender = this._getPlayer(defenderId);

    switch (ability.effect?.type) {

      case 'skip_defenses': {
        const count = ability.effect.count || 2;
        this.room.hypnoState[defenderId] = count;
        this.log.add(LOG_TYPES.ABILITY_SUCCESS,
          `🌀 ${attacker.name} hypnotized ${defender.name}! Next ${count} defenses will be skipped.`,
          { abilityId, target: defender.name, skipsGranted: count }
        );
        // Immediately consume the first skip as an attack
        return this._applyHypnoHit(attackerId, defenderId, { final: roll, raw: roll, penalty: 0 });
      }

      case 'break_protection_and_dot': {
        defender.protection = false;
        this.room.bcBrokenProtection = true;
        const dotId  = ability.effect.dotId;
        const dotCfg = this.rules.getDoTSystem(dotId);

        let immediateDmg = 0;
        if (dotCfg?.immediateHit) {
          immediateDmg = this._applyDamageAndLog(defenderId, dotCfg.immediateHit, 'bc_immediate');
        }

        if (dotCfg) {
          this.timers.startDoT(dotId, dotCfg.intervalMinutes * 60 * 1000, () => {
            const dmg = this._applyDamageAndLog(defenderId, dotCfg.damagePerTick, dotId);
            if (dmg > 0) {
              this.log.add(LOG_TYPES.DOT_DAMAGE,
                dotCfg.message
                  .replace('{target}', defender.name)
                  .replace('{damage}', dmg)
              );
            }
            this._checkAllDefeats();
          });
        }

        this.log.add(LOG_TYPES.ABILITY_SUCCESS,
          `⛓️ BC Curse! ${defender.name}'s protection broken! ${immediateDmg} immediate damage + ongoing curse.`,
          { abilityId, target: defender.name, immediateDamage: immediateDmg }
        );
        this.log.add(LOG_TYPES.PROTECTION_CHANGE,
          `🛡️ ${defender.name}: Protection OFF`,
          { player: defender.name, protection: false }
        );

        if (this._checkAllDefeats()) return { ok: true };
        this.timers.setCooldown(attackerId, (this.room.settings.cooldownSeconds * 1000));
        this._passTurn();
        return { ok: true };
      }

      case 'instant_self_damage': {
        // WEAKNESS: defender damages themselves
        const dmg = this._applyDamageAndLog(attackerId, ability.effect.damage, 'weakness');
        this.log.add(LOG_TYPES.ABILITY_SUCCESS,
          `🎯 ${attacker.name} acknowledged a weakness. Lost ${dmg} HP.`,
          { abilityId, damage: dmg }
        );
        if (this._checkAllDefeats()) return { ok: true };
        return { ok: true };
      }

      case 'apply_special_status': {
        // P: set pStatus on target
        defender.pStatus = true;
        this.log.add(LOG_TYPES.ABILITY_SUCCESS,
          `✨ ${defender.name} received Status P.`,
          { abilityId, target: defender.name }
        );
        return { ok: true };
      }

      default:
        return { ok: false, error: `Unknown ability effect: ${ability.effect?.type}` };
    }
  }

  // ─── Defeat & Round End ──────────────────────────────────────────────────────

  _checkAllDefeats() {
    for (const pid of this.room.playerOrder) {
      const player = this._getPlayer(pid);
      if (player && this.hp.isDefeated(player)) {
        if (player.status !== 'MB') {
          player.status = 'MB';
        }
        const winnerId   = this._getOpponentId(pid);
        const winnerName = this._getPlayer(winnerId)?.name;

        this.room.winner = { id: winnerId, name: winnerName };
        this.room.phase  = 'mb';

        this.log.add(LOG_TYPES.MB_TRIGGERED,
          `💀 ${player.name} has been defeated! ${winnerName} wins the round.`,
          { defeated: player.name, winner: winnerName }
        );
        return true;
      }
    }
    return false;
  }

  finishRound(socketId) {
    if (socketId !== this.room.ownerId) return { ok: false, error: 'Room owner only' };
    if (this.room.phase !== 'mb') return { ok: false, error: 'No defeated player yet' };

    // Stop per-round timers
    this.timers.stopAll();

    // Award round win
    const winnerName = this.room.winner?.name;
    if (winnerName) {
      this.room.roundScores[winnerName] = (this.room.roundScores[winnerName] || 0) + 1;
    }

    this.log.add('round_over',
      `🏆 Round ${this.room.currentRound} — ${winnerName} wins! (${this._scoreString()})`,
      { round: this.room.currentRound, winner: winnerName, scores: this.room.roundScores }
    );

    const winnerScore = this.room.roundScores[winnerName] || 0;
    const winsNeeded  = this.rules.getWinsRequired(this.room.settings.bestOf);
    const challengeWon = winnerScore >= winsNeeded;

    if (challengeWon) {
      this._endChallenge(winnerName);
    } else {
      this._startNextRound();
    }

    return { ok: true, challengeWon };
  }

  _endChallenge(winnerName) {
    this.room.phase       = 'ended';
    this.room.endedAt     = Date.now();
    this.room.matchWinner = winnerName;

    // Check P conditions
    const defId     = this.room.playerOrder.find(pid => this.room.players[pid]?.role === 'defender');
    const defender  = this.room.players[defId];
    const attId     = this.room.playerOrder.find(pid => this.room.players[pid]?.role === 'attacker');
    const attName   = this.room.players[attId]?.name;

    this.room.defenderMBInFinalRound =
      defender?.status === 'MB' &&
      !defender?.protection &&
      winnerName === attName;

    this.log.add('game_over',
      `🏆 Challenge complete! ${winnerName} wins! Final score — ${this._scoreString()}`,
      { winner: winnerName, scores: this.room.roundScores }
    );
  }

  _startNextRound() {
    this.room.currentRound++;
    this.room.phase          = 'initiative';
    this.room.initiativeRolls = {};
    this.room.pendingDefense  = false;
    this.room.pendingAttack   = null;
    this.room.currentAttacker = null;
    this.room.winner          = null;
    this.room.cooldownEnd     = {};
    this.room.hypnoState      = {};
    this.room.bcBrokenProtection = false;

    this.turns.reset();

    this.room.playerOrder.forEach(pid => {
      resetPlayerForRound(this.room.players[pid], this.rules, this.room.settings);
      this.stats.init(pid);
    });

    // Restart protection drain if applicable
    if (!this.room.settings.protectionEnabled) {
      const dot = this.rules.getDoTSystem('protection_drain');
      if (dot) {
        this.timers.startDoT('protection_drain',
          dot.intervalMinutes * 60 * 1000,
          () => this._tickProtectionDrain(dot)
        );
      }
    }

    this.log.add('round_start',
      `⚔️ Round ${this.room.currentRound} begins! Roll initiative!`,
      { round: this.room.currentRound }
    );
  }

  _scoreString() {
    return this.room.playerOrder
      .map(pid => `${this.room.players[pid].name}: ${this.room.roundScores[this.room.players[pid].name] || 0}`)
      .join(', ');
  }

  // ─── Manual Actions (room owner only) ────────────────────────────────────────

  manualAction(socketId, actionId, targetName, params = {}) {
    if (socketId !== this.room.ownerId) return { ok: false, error: 'Room owner only' };

    const controls = this.rules.getManualControls();
    const action   = controls.find(a => a.id === actionId);
    if (!action) return { ok: false, error: `Unknown action: ${actionId}` };

    const targetId = this.room.playerOrder.find(
      pid => this.room.players[pid]?.name === targetName
    );
    if (!targetId) return { ok: false, error: `Player not found: ${targetName}` };

    const target = this.room.players[targetId];

    if (action.setsStatus) {
      const old = target.status;
      target.status = action.setsStatus;
      this.log.add(LOG_TYPES.MANUAL_ACTION,
        `🔧 ${action.label}: ${targetName} status ${old} → ${action.setsStatus}`,
        { action: actionId, target: targetName, from: old, to: action.setsStatus }
      );
    }

    if (actionId === 'set_status' && params.status) {
      const old = target.status;
      target.status = params.status;
      this.log.add(LOG_TYPES.MANUAL_ACTION,
        `🔧 Host set ${targetName} status: ${old} → ${params.status}`,
        { action: actionId, target: targetName, from: old, to: params.status }
      );
    }

    if (actionId === 'restore_protection') {
      target.protection = true;
      this.log.add(LOG_TYPES.PROTECTION_CHANGE,
        `🛡️ Host restored protection for ${targetName}`,
        { action: actionId, target: targetName }
      );
    }

    return { ok: true };
  }

  // ─── P Roll ──────────────────────────────────────────────────────────────────

  rollP(socketId) {
    if (this.room.phase !== 'ended') return { ok: false, error: 'P only available after challenge ends' };

    const me = this._getPlayer(socketId);
    if (!me || me.role !== 'attacker') return { ok: false, error: 'Attacker only' };
    if (me.pAttempted) return { ok: false, error: 'P already attempted' };
    if (this.room.matchWinner !== me.name) return { ok: false, error: 'Only the challenge winner can attempt P' };
    if (!this.room.defenderMBInFinalRound) return { ok: false, error: 'P conditions not met' };

    const defId   = this.room.playerOrder.find(pid => this.room.players[pid]?.role === 'defender');
    const defender = this.room.players[defId];
    if (!defender || defender.protection) return { ok: false, error: 'P requires Defender protection OFF' };

    me.pAttempted = true;

    const { roll, success } = this.dice.rollForAbility('P');
    this.log.add('p_roll',
      success
        ? `✨ ${me.name} rolled ${roll} — P successful! ${defender.name} received Status P.`
        : `✨ ${me.name} attempted P — rolled ${roll}. P failed.`,
      { player: me.name, roll, success }
    );

    if (success) {
      const result = this._applyAbilityEffect('P', this.rules.getAbility('P'), socketId, defId, roll);
      return result;
    }

    return { ok: true, success: false };
  }

  _passTurn() {
    // Ensure room.currentAttacker always stays in sync with TurnManager
    this.turns.passTurn(this.room.playerOrder);
    this.room.currentAttacker = this.turns.currentAttackerId;
  }
  // ─── Getters for socket server ───────────────────────────────────────────────

  getTimers()    { return this.timers; }
  getLog()       { return this.log; }
  getStats()     { return this.stats; }
}

module.exports = MatchManager;
