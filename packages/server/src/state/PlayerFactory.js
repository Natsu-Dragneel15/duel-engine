/**
 * PlayerFactory
 * Creates a fresh player state object for a new match or round reset.
 * All defaults come from the RuleEngine, never hardcoded here.
 */

function createPlayer(name, role, ruleEngine, settings = {}) {
  const hasProtection = settings.protectionEnabled !== false;
  const startingHp    = settings.startingHp || ruleEngine.getStartingHp();
  const startingStatus = ruleEngine.getStartingStatus(hasProtection);

  return {
    name,
    role,
    hp:        startingHp,
    maxHp:     startingHp,
    status:    startingStatus,
    protection: hasProtection,
    ready:     false,
    connected: true,
    pStatus:   false,
    abilityUses: {},   // abilityId → count used this match
    pAttempted: false,
    stats: {
      attacks:        0,
      hits:           0,
      misses:         0,
      highRoll:       0,
      lowRoll:        99,
      totalRoll:      0,
      rollCount:      0,
      damageDealt:    0,
      damageReceived: 0,
      statusChanges:  0,
      abilitiesUsed:  {}
    }
  };
}

/** Reset a player for the next round (preserves name, role, match-level flags) */
function resetPlayerForRound(player, ruleEngine, settings = {}) {
  const hasProtection  = settings.protectionEnabled !== false;
  const startingHp     = settings.startingHp || ruleEngine.getStartingHp();
  const startingStatus = ruleEngine.getStartingStatus(hasProtection);

  player.hp         = startingHp;
  player.maxHp      = startingHp;
  player.status     = startingStatus;
  player.protection = hasProtection;
  player.ready      = false;
  player.pStatus    = false;
  player.abilityUses = {};
  player.pAttempted  = false;
  player.stats = {
    attacks: 0, hits: 0, misses: 0,
    highRoll: 0, lowRoll: 99, totalRoll: 0, rollCount: 0,
    damageDealt: 0, damageReceived: 0, statusChanges: 0, abilitiesUsed: {}
  };
  return player;
}

module.exports = { createPlayer, resetPlayerForRound };
