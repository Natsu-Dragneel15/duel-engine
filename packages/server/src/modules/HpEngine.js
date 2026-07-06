/**
 * HpEngine
 * Handles all HP changes. Always checks for status transitions after damage.
 * Never knows what the statuses mean — asks RuleEngine.
 */
class HpEngine {
  constructor(ruleEngine) {
    this.rules = ruleEngine;
  }

  /**
   * Apply damage to a player.
   * Returns { prev, current, damage, statusChanged, oldStatus, newStatus }
   */
  applyDamage(player, amount) {
    const prev = player.hp;
    player.hp = Math.max(this.rules.getHpMin(), player.hp - amount);
    const actual = prev - player.hp;

    const result = {
      prev,
      current: player.hp,
      damage: actual,
      statusChanged: false,
      oldStatus: player.status,
      newStatus: player.status
    };

    // Check if HP crossing a threshold should change status
    const thresholdStatus = this.rules.getStatusFromHp(player.hp, player.maxHp);
    if (thresholdStatus && thresholdStatus !== player.status) {
      // Only progress forward — never go backwards
      const statusList = this.rules.getStatusList().map(s => s.id);
      const currentIdx = statusList.indexOf(player.status);
      const newIdx = statusList.indexOf(thresholdStatus);
      if (newIdx > currentIdx) {
        player.status = thresholdStatus;
        result.statusChanged = true;
        result.newStatus = thresholdStatus;
      }
    }

    return result;
  }

  isDefeated(player) {
    return this.rules.isDefeated(player.status) || player.hp <= this.rules.getHpMin();
  }

  getHpPercent(player) {
    return player.maxHp > 0 ? player.hp / player.maxHp : 0;
  }
}

module.exports = HpEngine;
