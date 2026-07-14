/**
 * Duel Engine Platform — Server
 * Express + Socket.IO entry point.
 *
 * This file is intentionally thin.
 * All game logic lives in MatchManager and RuleEngine.
 * This file only: receives events, calls the right handler, broadcasts state.
 */

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const RuleEngine         = require('./engine/RuleEngine');
const RoomStore          = require('./state/RoomStore');
const { createPlayer }   = require('./state/PlayerFactory');
const ClientStateBuilder = require('./state/ClientStateBuilder');
const MatchManager       = require('./modules/MatchManager');
const CLIENT_EVENTS = { CREATE_ROOM:'create_room', JOIN_ROOM:'join_room', SET_READY:'set_ready', START_MATCH:'start_match', ROLL_INITIATIVE:'roll_initiative', ATTACK:'attack', DEFEND:'defend', USE_ABILITY:'use_ability', FINISH_ROUND:'finish_round', MANUAL_ACTION:'manual_action', EXPORT_LOG:'export_log' };
const SERVER_EVENTS = { ROOM_CREATED:'room_created', ROOM_JOINED:'room_joined', STATE_UPDATE:'state_update', ERROR:'error', PLAYER_JOINED:'player_joined', PLAYER_DISCONNECTED:'player_disconnected', ALL_READY:'all_ready', EXPORT_DATA:'export_data' };

// ─── Load preset(s) ──────────────────────────────────────────────────────────
// Stage 1: one preset loaded at startup. Stage 2+: loaded from database per room.
const shadowDuelPreset = require('./presets/shadow-duel.json');
const PRESETS = {
  'shadow-duel': shadowDuelPreset
};

// ─── App Setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout:  5000
});

app.use(express.json());

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (_, res) =>
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'))
  );
}

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  status: 'ok',
  rooms:  RoomStore.size(),
  uptime: process.uptime()
}));

app.get('/api/presets', (_, res) => res.json(
  Object.entries(PRESETS).map(([id, p]) => ({
    id,
    name:        p.meta.name,
    description: p.meta.description,
    players:     p.meta.players
  }))
));

// ─── Per-room state ───────────────────────────────────────────────────────────
// Each room has its own RuleEngine, MatchManager, and ClientStateBuilder
const roomEngines  = new Map(); // code → RuleEngine
const roomManagers = new Map(); // code → MatchManager
const roomBuilders = new Map(); // code → ClientStateBuilder

function getEngine(code)  { return roomEngines.get(code);  }
function getManager(code) { return roomManagers.get(code); }
function getBuilder(code) { return roomBuilders.get(code); }

// ─── Broadcast ───────────────────────────────────────────────────────────────
function broadcastState(code) {
  const room    = RoomStore.get(code);
  const builder = getBuilder(code);
  const manager = getManager(code);
  if (!room || !builder) return;

  room.playerOrder.forEach(pid => {
    const socket = io.sockets.sockets.get(pid);
    if (!socket) return;
    const state = builder.build(room, pid, manager?.getTimers());
    socket.emit(SERVER_EVENTS.STATE_UPDATE, state);
  });
}

function emitError(socket, message) {
  socket.emit(SERVER_EVENTS.ERROR, { message });
}

// ─── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  // ── Create Room ─────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.CREATE_ROOM, ({ presetId = 'shadow-duel', playerName, settings = {}, customPreset = null, creatorRole = 'defender' }) => {
    if (!playerName?.trim()) return emitError(socket, 'Name required');
    const name   = playerName.trim().slice(0, 20);
    const preset = customPreset || PRESETS[presetId];
    if (!preset) return emitError(socket, 'Unknown preset');
    if (!preset.meta || !preset.players || !preset.combat) return emitError(socket, 'Invalid preset config');

    const rules = new RuleEngine(preset);
    const room  = RoomStore.create(preset, {
      bestOf:            settings.bestOf            || 1,
      protectionEnabled: settings.protectionEnabled !== false,
      diceFaces:         settings.diceFaces         || rules.getDefaultDiceFaces(),
      startingHp:        settings.startingHp        || rules.getStartingHp(),
      damage:            settings.damage            || rules.getDamage(),
      cooldownSeconds:   parseInt(settings.cooldownSeconds) || 120,
      prize:             (settings.prize || '').slice(0, 100)
    });

    // Creator role is chosen by the host
    const assignedRole = ['defender','attacker'].includes(creatorRole) ? creatorRole : 'defender';
    room.players[socket.id] = createPlayer(name, assignedRole, rules, room.settings);
    room.playerOrder.push(socket.id);
    room.ownerId = socket.id;

    roomEngines.set(room.code, rules);
    roomBuilders.set(room.code, new ClientStateBuilder(rules));

    socket.join(room.code);
    socket.emit(SERVER_EVENTS.ROOM_CREATED, { code: room.code, role: assignedRole, playerId: socket.id });
    console.log(`[Room] Created ${room.code} by ${name}`);
    broadcastState(room.code);
  });

  // ── Join Room ───────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.JOIN_ROOM, ({ code, playerName }) => {
    if (!playerName?.trim() || !code) return emitError(socket, 'Name and code required');
    code = code.trim().toUpperCase();
    const name = playerName.trim().slice(0, 20);
    const room = RoomStore.get(code);
    if (!room) return emitError(socket, 'Room not found');

    // Handle reconnection
    if (room.playerOrder.length >= 2) {
      const existingId = room.playerOrder.find(pid =>
        room.players[pid]?.name === name && !room.players[pid]?.connected
      );
      if (existingId) {
        room.players[existingId].connected = true;
        room.players[socket.id] = room.players[existingId];
        delete room.players[existingId];
        room.playerOrder = room.playerOrder.map(pid => pid === existingId ? socket.id : pid);
        if (room.currentAttacker === existingId) room.currentAttacker = socket.id;
        if (room.ownerId === existingId) room.ownerId = socket.id;
        if (room.disconnectTimers?.[existingId]) {
          clearTimeout(room.disconnectTimers[existingId]);
          delete room.disconnectTimers[existingId];
        }
        socket.join(code);
        socket.emit(SERVER_EVENTS.ROOM_JOINED, { code, role: room.players[socket.id].role, playerId: socket.id });
        broadcastState(code);
        return;
      }
      return emitError(socket, 'Room is full');
    }

    if (room.phase !== 'lobby') return emitError(socket, 'Match already started');

    const rules = getEngine(code);
    // Joiner gets the opposite role of the creator
    const creatorPlayer = room.players[room.ownerId];
    const joinerRole = creatorPlayer?.role === 'defender' ? 'attacker' : 'defender';
    room.players[socket.id] = createPlayer(name, joinerRole, rules, room.settings);
    room.playerOrder.push(socket.id);

    socket.join(code);
    socket.emit(SERVER_EVENTS.ROOM_JOINED, { code, role: joinerRole, playerId: socket.id });
    io.to(code).emit(SERVER_EVENTS.PLAYER_JOINED, { name });
    broadcastState(code);
    console.log(`[Room] ${name} joined ${code}`);
  });

  // ── Ready ───────────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.SET_READY, ({ ready }) => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (room.phase !== 'lobby') return;
    if (!room.players[socket.id]) return;
    room.players[socket.id].ready = !!ready;
    broadcastState(code);
    const allReady = room.playerOrder.length === 2 &&
      room.playerOrder.every(pid => room.players[pid]?.ready);
    if (allReady) io.to(code).emit(SERVER_EVENTS.ALL_READY);
  });

  // ── Start Match ─────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.START_MATCH, () => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (socket.id !== room.ownerId) return emitError(socket, 'Only room owner can start');
    if (room.playerOrder.length < 2) return emitError(socket, 'Need 2 players');
    if (room.phase !== 'lobby') return;
    if (!room.playerOrder.every(pid => room.players[pid]?.ready))
      return emitError(socket, 'Both players must be ready');

    const rules   = getEngine(code);
    const manager = new MatchManager(room, rules);
    roomManagers.set(code, manager);
    manager.startMatch();
    console.log(`[Match] Started in room ${code}`);
    broadcastState(code);
  });

  // ── Roll Initiative ─────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.ROLL_INITIATIVE, () => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const manager = getManager(code);
    if (!manager) return;
    const result = manager.rollInitiative(socket.id);
    if (!result.ok) return emitError(socket, result.error);
    // Broadcast twice to ensure phase transition is captured
    broadcastState(code);
    setTimeout(() => broadcastState(code), 100);
  });

  // ── Attack ──────────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.ATTACK, ({ abilityId } = {}) => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { code } = found;
    const manager = getManager(code);
    if (!manager) return;
    const result = manager.attack(socket.id, abilityId || null);
    if (!result.ok) return emitError(socket, result.error);
    broadcastState(code);
  });

  // ── Defend ──────────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.DEFEND, () => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { code } = found;
    const manager = getManager(code);
    if (!manager) return;
    const result = manager.defend(socket.id);
    if (!result.ok) return emitError(socket, result.error);
    broadcastState(code);
  });

  // ── Use Ability (standalone — P roll, weakness, etc.) ───────────────────────
  socket.on(CLIENT_EVENTS.USE_ABILITY, ({ abilityId, params = {} } = {}) => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    const manager = getManager(code);
    if (!manager) return;

    let result;
    if (abilityId === 'P') {
      result = manager.rollP(socket.id);
    } else {
      // Standalone ability (WEAKNESS — no attack roll needed)
      const rules   = getEngine(code);
      const ability = rules.getAbility(abilityId);
      if (!ability) return emitError(socket, `Unknown ability: ${abilityId}`);
      const me  = room.players[socket.id];
      const opp = room.players[room.playerOrder.find(pid => pid !== socket.id)];
      const check = rules.canUseAbility(abilityId, {
        player: me, opponent: opp, phase: room.phase
      });
      if (!check.allowed) return emitError(socket, check.reason);
      me.abilityUses[abilityId] = (me.abilityUses[abilityId] || 0) + 1;
      const defId = room.playerOrder.find(pid => pid !== socket.id);
      result = manager._applyAbilityEffect(abilityId, ability, socket.id, defId, null);
    }

    if (!result.ok) return emitError(socket, result.error);
    broadcastState(code);
  });

  // ── Finish Round ────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.FINISH_ROUND, () => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { code } = found;
    const manager = getManager(code);
    if (!manager) return;
    const result = manager.finishRound(socket.id);
    if (!result.ok) return emitError(socket, result.error);
    broadcastState(code);
  });

  // ── Manual Action (owner only) ──────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.MANUAL_ACTION, ({ actionId, targetName, params = {} } = {}) => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { code } = found;
    const manager = getManager(code);
    if (!manager) return;
    const result = manager.manualAction(socket.id, actionId, targetName, params);
    if (!result.ok) return emitError(socket, result.error);
    broadcastState(code);
  });

  // ── Export Log ──────────────────────────────────────────────────────────────
  socket.on("get_state", () => { const f = RoomStore.findBySocket(socket.id); if (f) broadcastState(f.code); });

  socket.on(CLIENT_EVENTS.EXPORT_LOG, () => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { room } = found;
    const manager  = getManager(found.code);
    socket.emit(SERVER_EVENTS.EXPORT_DATA, {
      log:       manager?.getLog().toJSON() || room.battleLog,
      settings:  room.settings,
      scores:    room.roundScores,
      winner:    room.matchWinner,
      startedAt: room.startedAt,
      endedAt:   room.endedAt
    });
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const found = RoomStore.findBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;

    if (room.players[socket.id]) {
      room.players[socket.id].connected = false;
      io.to(code).emit(SERVER_EVENTS.PLAYER_DISCONNECTED, {
        name: room.players[socket.id].name
      });
    }

    // Keep room alive for 30 minutes for reconnection
    room.disconnectTimers = room.disconnectTimers || {};
    room.disconnectTimers[socket.id] = setTimeout(() => {
      const allGone = room.playerOrder.every(pid => !room.players[pid]?.connected);
      if (allGone) {
        getManager(code)?.getTimers().stopAll();
        roomEngines.delete(code);
        roomManagers.delete(code);
        roomBuilders.delete(code);
        RoomStore.delete(code);
        console.log(`[Room] Cleaned up ${code}`);
      }
    }, 30 * 60 * 1000);

    broadcastState(code);
    console.log(`[-] ${socket.id}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚔️  Duel Engine running on http://localhost:${PORT}`);
  console.log(`   Presets loaded: ${Object.keys(PRESETS).join(', ')}`);
});
