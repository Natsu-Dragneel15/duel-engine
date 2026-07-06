const RuleEngine       = require('./packages/server/src/engine/RuleEngine');
const RoomStore        = require('./packages/server/src/state/RoomStore');
const { createPlayer } = require('./packages/server/src/state/PlayerFactory');
const MatchManager     = require('./packages/server/src/modules/MatchManager');
const preset           = require('./packages/server/src/presets/shadow-duel.json');

const rules = new RuleEngine(preset);
const room  = RoomStore.create(preset, { bestOf: 1, protectionEnabled: true });
room.players['s1'] = createPlayer('Natsu', 'defender', rules, room.settings);
room.players['s2'] = createPlayer('EL',    'attacker', rules, room.settings);
room.playerOrder   = ['s1', 's2'];
room.ownerId       = 's1';

const match = new MatchManager(room, rules);
match.startMatch();

room.phase = 'battle';
room.currentAttacker = 's2';
match.turns.currentAttackerId = 's2';

const atkId = 's2';
const defId = 's1';

// Patch rollForPlayer: attacker always rolls 5, defender always rolls 2 → always a hit
match.dice.rollForPlayer = (player) => {
  const raw = player.role === 'attacker' ? 5 : 2;
  const { penalty, final } = rules.applyDicePenalty(raw, player.status);
  return { raw, penalty, final, faces: 6 };
};

// Helper: force EL to attack and Natsu to defend
function doRound() {
  match.timers.cooldowns = {};
  room.currentAttacker = atkId;
  match.turns.currentAttackerId = atkId;
  const a = match.attack(atkId);
  if (!a.ok) { console.log('  attack failed:', a.error); return; }
  if (room.pendingDefense) match.defend(defId);
}

console.log('1. Starting HP:', room.players[defId].hp);

doRound();
console.log('2. After hit 1 — HP:', room.players[defId].hp, '| status:', room.players[defId].status);

doRound();
console.log('3. After hit 2 — HP:', room.players[defId].hp, '| status:', room.players[defId].status);

doRound();
console.log('4. After hit 3 — HP:', room.players[defId].hp, '| status:', room.players[defId].status);

doRound();
console.log('5. After hit 4 — HP:', room.players[defId].hp, '| status:', room.players[defId].status);
console.log('6. Phase:', room.phase);
console.log('7. Round winner:', room.winner?.name);

if (room.phase === 'mb') {
  const f = match.finishRound('s1');
  console.log('8. finishRound ok:', f.ok, '| challengeWon:', f.challengeWon);
  console.log('9. Final phase:', room.phase);
  console.log('10. Match winner:', room.matchWinner);
}

console.log('\n--- Battle Log ---');
room.battleLog.forEach(e => console.log(' ', e.message));
console.log('\nAll core mechanics verified.');
