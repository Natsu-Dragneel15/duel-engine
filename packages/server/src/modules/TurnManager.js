/**
 * TurnManager
 * Controls turn order, initiative, and whose turn it is.
 * Never makes game decisions — asks RuleEngine for rules.
 */
class TurnManager {
  constructor(ruleEngine) {
    this.rules = ruleEngine;
    this.currentAttackerId = null;
    this.initiativeRolls = {};  // playerId → roll
    this.pendingDefense = false;
    this.pendingAttack = null;  // { attackerId, roll }
  }

  reset() {
    this.currentAttackerId = null;
    this.initiativeRolls = {};
    this.pendingDefense = false;
    this.pendingAttack = null;
  }

  /** Record an initiative roll. Returns true if all players have rolled. */
  recordInitiative(playerId, roll) {
    this.initiativeRolls[playerId] = roll;
  }

  allRolledInitiative(playerIds) {
    return playerIds.every(id => this.initiativeRolls[id] !== undefined);
  }

  isTie(playerIds) {
    const rolls = playerIds.map(id => this.initiativeRolls[id]);
    return rolls.every(r => r === rolls[0]);
  }

  /** Determine who goes first. Returns winnerId or null on tie. */
  resolveInitiative(playerIds) {
    if (this.isTie(playerIds)) return null;
    return playerIds.reduce((best, id) =>
      (this.initiativeRolls[id] > this.initiativeRolls[best] ? id : best)
    , playerIds[0]);
  }

  clearInitiative() {
    this.initiativeRolls = {};
  }

  setAttacker(playerId) {
    this.currentAttackerId = playerId;
  }

  passTurn(playerIds) {
    const opp = playerIds.find(id => id !== this.currentAttackerId);
    if (opp) this.currentAttackerId = opp;
  }

  isAttacker(playerId) {
    return this.currentAttackerId === playerId;
  }

  setPendingDefense(attackerId, roll) {
    this.pendingDefense = true;
    this.pendingAttack = { attackerId, roll };
  }

  clearPendingDefense() {
    this.pendingDefense = false;
    this.pendingAttack = null;
  }
}

module.exports = TurnManager;
