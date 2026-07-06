/**
 * StatsTracker
 * Tracks per-player live statistics throughout the match.
 */
class StatsTracker {
  constructor() {
    this.stats = {}; // playerId → stats object
  }

  init(playerId) {
    this.stats[playerId] = {
      attacks: 0,
      hits: 0,
      misses: 0,
      highRoll: 0,
      lowRoll: 99,
      totalRoll: 0,
      rollCount: 0,
      damageDealt: 0,
      damageReceived: 0,
      statusChanges: 0,
      abilitiesUsed: {}
    };
  }

  get(playerId) {
    return this.stats[playerId] || null;
  }

  recordRoll(playerId, finalRoll) {
    const s = this.stats[playerId];
    if (!s) return;
    s.rollCount++;
    s.totalRoll += finalRoll;
    if (finalRoll > s.highRoll) s.highRoll = finalRoll;
    if (finalRoll < s.lowRoll) s.lowRoll = finalRoll;
  }

  recordAttack(playerId) {
    if (this.stats[playerId]) this.stats[playerId].attacks++;
  }

  recordHit(attackerId, defenderId, damage) {
    if (this.stats[attackerId]) this.stats[attackerId].hits++;
    if (this.stats[attackerId]) this.stats[attackerId].damageDealt += damage;
    if (this.stats[defenderId]) this.stats[defenderId].damageReceived += damage;
  }

  recordMiss(attackerId) {
    if (this.stats[attackerId]) this.stats[attackerId].misses++;
  }

  recordStatusChange(playerId) {
    if (this.stats[playerId]) this.stats[playerId].statusChanges++;
  }

  recordAbilityUse(playerId, abilityId) {
    const s = this.stats[playerId];
    if (!s) return;
    s.abilitiesUsed[abilityId] = (s.abilitiesUsed[abilityId] || 0) + 1;
  }

  getAverageRoll(playerId) {
    const s = this.stats[playerId];
    if (!s || s.rollCount === 0) return 0;
    return Math.round((s.totalRoll / s.rollCount) * 10) / 10;
  }

  getSummary(playerId) {
    const s = this.stats[playerId];
    if (!s) return null;
    return { ...s, averageRoll: this.getAverageRoll(playerId) };
  }
}

module.exports = StatsTracker;
