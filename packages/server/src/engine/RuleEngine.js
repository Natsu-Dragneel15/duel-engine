/**
 * RuleEngine
 *
 * Reads a preset config and provides a clean decisions API.
 * Contains NO hardcoded game rules.
 * The Game Engine calls this for every decision.
 *
 * Does NOT: talk to database, manage sockets, run timers, store state.
 * Does:     answer rule questions based on the loaded preset.
 */

class RuleEngine {
  constructor(presetConfig) {
    this.config = presetConfig;
    this._validateConfig();
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  _validateConfig() {
    const required = ['meta', 'players', 'dice', 'combat', 'statuses', 'abilities'];
    const missing = required.filter(k => !this.config[k]);
    if (missing.length > 0) {
      throw new Error(`Invalid preset: missing sections: ${missing.join(', ')}`);
    }
  }

  // ─── Meta ────────────────────────────────────────────────────────────────────

  getName()        { return this.config.meta.name; }
  getRoles()       { return this.config.meta.roles || ['attacker', 'defender']; }
  getMaxPlayers()  { return this.config.meta.players || 2; }

  // ─── Player Setup ────────────────────────────────────────────────────────────

  getStartingHp()  { return this.config.players.startingHp || 100; }
  getHpMin()       { return this.config.players.hpMin ?? 0; }

  /**
   * Starting status depends on whether protection is enabled.
   * The preset defines which status maps to each protection state.
   */
  getStartingStatus(hasProtection) {
    const statuses = this.config.statuses.list || [];
    if (hasProtection) {
      const s = statuses.find(s => s.protectionOn);
      return s?.id || statuses[0]?.id || 'N';
    } else {
      const s = statuses.find(s => s.protectionOff);
      return s?.id || statuses[0]?.id || 'N';
    }
  }

  isProtectionEnabled() {
    return this.config.protection?.enabled !== false;
  }

  isProtectionConfigurable() {
    return this.config.protection?.configurable !== false;
  }

  // ─── Dice ────────────────────────────────────────────────────────────────────

  getDefaultDiceFaces() {
    return this.config.dice?.defaultFaces || 6;
  }

  getValidDiceFaces() {
    return this.config.dice?.faces || [4, 6, 8, 10, 12, 20];
  }

  /**
   * Apply dice penalty based on player's current status.
   * Returns { raw, penalty, final } — server always passes all three to clients.
   */
  applyDicePenalty(rawRoll, playerStatus) {
    const statusConfig = this._getStatusConfig(playerStatus);
    const penalty = statusConfig?.dicePenalty ? Math.abs(statusConfig.dicePenalty) : 0;
    const final = Math.max(1, rawRoll - penalty);
    return { raw: rawRoll, penalty, final };
  }

  // ─── Status ──────────────────────────────────────────────────────────────────

  getStatusList() {
    return this.config.statuses.list || [];
  }

  /**
   * Given current HP and max HP, return what status the player should be in.
   * Only used when progression = 'hp_threshold'.
   * Returns null if no threshold matches (status shouldn't change).
   */
  getStatusFromHp(hp, maxHp) {
    if (this.config.statuses.progression !== 'hp_threshold') return null;

    const pct = maxHp > 0 ? hp / maxHp : 0;
    const statuses = this.getStatusList();

    // Find the highest threshold the player has crossed
    // Statuses must be defined in order from highest threshold to lowest
    for (const status of [...statuses].reverse()) {
      if (status.hpThreshold !== undefined && pct <= status.hpThreshold) {
        return status.id;
      }
    }
    return null;
  }

  isDefeated(playerStatus) {
    const statusConfig = this._getStatusConfig(playerStatus);
    return statusConfig?.defeated === true;
  }

  isDefeatedByHp(hp) {
    return hp <= this.getHpMin();
  }

  _getStatusConfig(statusId) {
    return this.getStatusList().find(s => s.id === statusId) || null;
  }

  // ─── Combat ──────────────────────────────────────────────────────────────────

  getDamage()           { return this.config.combat?.damage || 25; }
  getCooldownMs()       { return (this.config.combat?.attackCooldownSeconds || 120) * 1000; }
  getInitiativeMethod() { return this.config.combat?.initiative?.method || 'dice_roll'; }
  getInitiativeTieRule(){ return this.config.combat?.initiative?.tieRule || 'reroll'; }

  /**
   * Resolve an attack: does the attack hit?
   * Returns 'hit' or 'miss'.
   * Tie rule is read from preset — default: attacker wins ties.
   */
  resolveAttack(attackRoll, defenseRoll) {
    const tieRule = this.config.combat?.tieRule || 'attacker_wins';
    if (attackRoll > defenseRoll) return 'hit';
    if (attackRoll < defenseRoll) return 'miss';
    // Tie
    return tieRule === 'attacker_wins' ? 'hit' : 'miss';
  }

  // ─── Abilities ───────────────────────────────────────────────────────────────

  getAbilities() {
    return this.config.abilities || [];
  }

  getAbility(abilityId) {
    return this.getAbilities().find(a => a.id === abilityId) || null;
  }

  getAbilitiesForRole(role) {
    return this.getAbilities().filter(a =>
      !a.availableTo || a.availableTo.includes(role)
    );
  }

  /**
   * Check if an ability can be used right now.
   * gameState = { player, opponent, phase, currentRound, bestOf, matchWinner }
   * Returns { allowed: bool, reason: string }
   */
  canUseAbility(abilityId, gameState) {
    const ability = this.getAbility(abilityId);
    if (!ability) return { allowed: false, reason: 'Unknown ability' };

    const { player, opponent } = gameState;

    // Role check
    if (ability.availableTo && !ability.availableTo.includes(player.role)) {
      return { allowed: false, reason: `${abilityId} is not available to ${player.role}` };
    }

    // Uses per match
    const usesKey = `${abilityId}_uses`;
    const usedCount = player.abilityUses?.[abilityId] || 0;
    const maxUses = ability.usesPerMatch ?? 1;
    if (usedCount >= maxUses) {
      return { allowed: false, reason: `${abilityId} already used this match` };
    }

    // Prerequisites
    if (ability.prerequisite) {
      if (ability.prerequisite.defenderProtection === true && !opponent.protection) {
        return { allowed: false, reason: `${abilityId} requires Defender to have Protection ON` };
      }
      if (ability.prerequisite.defenderProtection === false && opponent.protection) {
        return { allowed: false, reason: `${abilityId} requires Defender to have Protection OFF` };
      }
    }

    // Availability conditions (for post-match abilities like P)
    if (ability.availability) {
      const avail = ability.availability;
      if (avail.phase && gameState.phase !== avail.phase) {
        return { allowed: false, reason: `${abilityId} not available in current phase` };
      }
      if (avail.challengeWinner === 'attacker' && gameState.matchWinner !== player.name) {
        return { allowed: false, reason: `${abilityId} only available to challenge winner` };
      }
      if (avail.defenderStatus && opponent.status !== avail.defenderStatus) {
        return { allowed: false, reason: `${abilityId} requires Defender to be in status ${avail.defenderStatus}` };
      }
      if (avail.defenderProtection === false && opponent.protection) {
        return { allowed: false, reason: `${abilityId} requires Defender Protection OFF` };
      }
    }

    return { allowed: true, reason: null };
  }

  /**
   * Resolve an ability roll.
   * Returns { success: bool, roll: number }
   */
  resolveAbilityRoll(abilityId, roll) {
    const ability = this.getAbility(abilityId);
    if (!ability?.requiresRoll) return { success: true, roll: null };

    const condition = ability.successCondition;
    if (!condition) return { success: true, roll };

    let success = false;
    if (condition.type === 'exact')   success = roll === condition.value;
    if (condition.type === 'gte')     success = roll >= condition.value;
    if (condition.type === 'lte')     success = roll <= condition.value;

    return { success, roll };
  }

  // ─── Damage Over Time ─────────────────────────────────────────────────────────

  getDoTSystems() {
    return this.config.dotSystems || [];
  }

  getDoTSystem(id) {
    return this.getDoTSystems().find(d => d.id === id) || null;
  }

  /**
   * Check if a DoT system should start given a trigger event.
   * trigger = 'protection_off_at_start' | 'bc_ability_success' | etc.
   */
  shouldStartDoT(dotId, trigger) {
    const dot = this.getDoTSystem(dotId);
    return dot?.trigger === trigger;
  }

  // ─── Match Format ─────────────────────────────────────────────────────────────

  getDefaultFormat() {
    return this.config.match?.defaultFormat || 'best_of_1';
  }

  getAvailableFormats() {
    return this.config.match?.formats || ['best_of_1'];
  }

  getWinsRequired(bestOf) {
    return Math.ceil(bestOf / 2);
  }

  // ─── Manual Controls ─────────────────────────────────────────────────────────

  getManualControls() {
    return this.config.manualControls?.actions || [];
  }

  getManualControlsOwner() {
    return this.config.manualControls?.availableTo || ['defender'];
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────

  getTheme() {
    return this.config.ui?.theme || 'dark';
  }

  getColors() {
    return this.config.ui?.colors || {};
  }
}

module.exports = RuleEngine;
