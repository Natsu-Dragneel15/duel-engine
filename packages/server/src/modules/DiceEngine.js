/**
 * DiceEngine
 * All dice rolls happen here. Clients NEVER roll dice.
 * Server-authoritative: this is the only source of random numbers in the game.
 */
class DiceEngine {
  constructor(ruleEngine) {
    this.rules = ruleEngine;
  }

  /** Roll a single die with N faces */
  roll(faces) {
    return Math.floor(Math.random() * faces) + 1;
  }

  /** Roll for a player, applying status-based penalty from preset */
  rollForPlayer(player) {
    const faces = this.rules.getDefaultDiceFaces();
    const raw = this.roll(faces);
    const { penalty, final } = this.rules.applyDicePenalty(raw, player.status);
    return { raw, penalty, final, faces };
  }

  /** Roll for an ability (no penalty applied — ability rolls use raw values) */
  rollForAbility(abilityId) {
    const faces = this.rules.getDefaultDiceFaces();
    const roll = this.roll(faces);
    const { success } = this.rules.resolveAbilityRoll(abilityId, roll);
    return { roll, success, faces };
  }

  /** Build a human-readable roll message */
  formatRollMessage(playerName, rollResult, context) {
    const { raw, penalty, final } = rollResult;
    if (penalty > 0) {
      return `🎲 ${playerName} rolled ${raw}. Status penalty: -${penalty}. Final roll: ${final}.`;
    }
    return `🎲 ${playerName} rolled ${final}.`;
  }
}

module.exports = DiceEngine;
