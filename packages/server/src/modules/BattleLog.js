/**
 * BattleLog
 * Append-only log of every event in a match.
 * Every entry has a type, timestamp, and message.
 */
const { v4: uuidv4 } = require('uuid');

class BattleLog {
  constructor() {
    this.entries = [];
  }

  add(type, message, payload = {}) {
    const entry = {
      id: uuidv4(),
      type,
      message,
      timestamp: Date.now(),
      ...payload
    };
    this.entries.push(entry);
    return entry;
  }

  /** Return the last N entries (for sending to clients) */
  recent(n = 50) {
    return this.entries.slice(-n);
  }

  /** Return all entries */
  all() {
    return [...this.entries];
  }

  /** Export as plain text */
  toText(matchMeta = {}) {
    const header = [
      'DUEL ENGINE — BATTLE LOG',
      `Preset: ${matchMeta.presetName || 'Unknown'}`,
      `Room: ${matchMeta.roomCode || 'Unknown'}`,
      `Started: ${matchMeta.startedAt ? new Date(matchMeta.startedAt).toLocaleString() : 'N/A'}`,
      '─'.repeat(50)
    ].join('\n');

    const body = this.entries.map(e =>
      `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.message}`
    ).join('\n');

    return `${header}\n${body}`;
  }

  /** Export as JSON */
  toJSON() {
    return this.entries;
  }
}

module.exports = BattleLog;
