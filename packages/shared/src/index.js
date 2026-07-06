/**
 * @duel-engine/shared
 * Constants and types shared between server and client.
 * Never import server-only or client-only code here.
 */

// ─── Match Phases ─────────────────────────────────────────────────────────────
const PHASES = {
  LOBBY:      'lobby',
  INITIATIVE: 'initiative',
  BATTLE:     'battle',
  MB:         'mb',        // a player is defeated, waiting for owner to finish round
  ENDED:      'ended'
};

// ─── Player Roles ─────────────────────────────────────────────────────────────
const ROLES = {
  ATTACKER: 'attacker',
  DEFENDER: 'defender'
};

// ─── Socket Events: Client → Server ───────────────────────────────────────────
const CLIENT_EVENTS = {
  CREATE_ROOM:      'create_room',
  JOIN_ROOM:        'join_room',
  SET_READY:        'set_ready',
  START_MATCH:      'start_match',
  ROLL_INITIATIVE:  'roll_initiative',
  ATTACK:           'attack',
  DEFEND:           'defend',
  USE_ABILITY:      'use_ability',
  FINISH_ROUND:     'finish_round',
  MANUAL_ACTION:    'manual_action',
  EXPORT_LOG:       'export_log'
};

// ─── Socket Events: Server → Client ───────────────────────────────────────────
const SERVER_EVENTS = {
  ROOM_CREATED:         'room_created',
  ROOM_JOINED:          'room_joined',
  STATE_UPDATE:         'state_update',
  ERROR:                'error',
  PLAYER_JOINED:        'player_joined',
  PLAYER_DISCONNECTED:  'player_disconnected',
  ALL_READY:            'all_ready',
  EXPORT_DATA:          'export_data'
};

// ─── Log Entry Types ──────────────────────────────────────────────────────────
const LOG_TYPES = {
  MATCH_START:        'match_start',
  ROUND_START:        'round_start',
  ROUND_OVER:         'round_over',
  GAME_OVER:          'game_over',
  INITIATIVE:         'initiative',
  INITIATIVE_TIE:     'initiative_tie',
  INITIATIVE_RESULT:  'initiative_result',
  ATTACK_ROLL:        'attack_roll',
  DEFENSE_ROLL:       'defense_roll',
  HIT:                'hit',
  MISS:               'miss',
  ABILITY_USE:        'ability_use',
  ABILITY_SUCCESS:    'ability_success',
  ABILITY_FAIL:       'ability_fail',
  STATUS_CHANGE:      'status_change',
  MANUAL_ACTION:      'manual_action',
  DOT_DAMAGE:         'dot_damage',
  PROTECTION_CHANGE:  'protection_change',
  MB_TRIGGERED:       'mb_triggered'
};

// ─── Match Formats ────────────────────────────────────────────────────────────
const FORMATS = {
  BEST_OF_1: 'best_of_1',
  BEST_OF_3: 'best_of_3',
  BEST_OF_5: 'best_of_5',
  BEST_OF_7: 'best_of_7',
  CUSTOM:    'custom'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Given a bestOf number, return wins required to claim the match */
function winsRequired(bestOf) {
  return Math.ceil(bestOf / 2);
}

/** Generate a random room code */
function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Format milliseconds as MM:SS */
function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

module.exports = {
  PHASES,
  ROLES,
  CLIENT_EVENTS,
  SERVER_EVENTS,
  LOG_TYPES,
  FORMATS,
  winsRequired,
  generateRoomCode,
  formatTime
};
