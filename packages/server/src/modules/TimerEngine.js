/**
 * TimerEngine
 * Manages all server-side timers: DoT, cooldowns, match timer.
 * Stores start times so reconnecting clients get accurate countdowns.
 * All timers are server-authoritative.
 */
class TimerEngine {
  constructor(ruleEngine) {
    this.rules = ruleEngine;
    this.timers = {};      // id → { handle, startedAt, intervalMs }
    this.cooldowns = {};   // playerId → expiresAt timestamp
  }

  /** Start a repeating DoT timer */
  startDoT(id, intervalMs, onTick) {
    if (this.timers[id]) return; // already running
    const handle = setInterval(onTick, intervalMs);
    this.timers[id] = { handle, startedAt: Date.now(), intervalMs };
  }

  stopDoT(id) {
    if (this.timers[id]) {
      clearInterval(this.timers[id].handle);
      delete this.timers[id];
    }
  }

  stopAll() {
    Object.keys(this.timers).forEach(id => this.stopDoT(id));
    this.cooldowns = {};
  }

  /** Set cooldown for a player */
  setCooldown(playerId, durationMs) {
    this.cooldowns[playerId] = Date.now() + durationMs;
  }

  /** Check if player is on cooldown */
  isOnCooldown(playerId) {
    return Date.now() < (this.cooldowns[playerId] || 0);
  }

  /** Get remaining cooldown ms (0 if not on cooldown) */
  getCooldownRemaining(playerId) {
    return Math.max(0, (this.cooldowns[playerId] || 0) - Date.now());
  }

  /** Get remaining ms until next DoT tick */
  getDoTRemaining(id) {
    const t = this.timers[id];
    if (!t) return null;
    const elapsed = Date.now() - t.startedAt;
    const tickNumber = Math.floor(elapsed / t.intervalMs);
    const nextTick = (tickNumber + 1) * t.intervalMs;
    return Math.max(0, nextTick - elapsed);
  }
}

module.exports = TimerEngine;
