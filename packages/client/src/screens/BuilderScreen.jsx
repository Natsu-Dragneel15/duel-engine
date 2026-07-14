import { useState } from 'react';
import useGameStore from '../store/gameStore';

// ── Default preset template (what a new game starts with) ──────────────────
const DEFAULT_PRESET = {
  meta: {
    name: 'My Game',
    description: '',
    icon: '⚔️',
    roles: ['attacker', 'defender']
  },
  players: { startingHp: 100 },
  dice: { defaultFaces: 6, faces: [4, 6, 8, 10, 12, 20] },
  combat: { damage: 25, attackCooldownSeconds: 30, tieRule: 'attacker_wins' },
  protection: { enabled: true, configurable: true },
  statuses: {
    progression: 'hp_threshold',
    list: [
      { id: 'N', label: 'N', tooltip: 'Normal', protectionOn: true },
      { id: 'R', label: 'R', tooltip: 'Restricted', protectionOff: true },
      { id: 'A', label: 'A', tooltip: 'Status A', hpThreshold: 0.75 },
      { id: 'H', label: 'H', tooltip: 'Status H', hpThreshold: 0.50 },
      { id: 'AD', label: 'AD', tooltip: 'Status AD', hpThreshold: 0.25, dicePenalty: -1 },
      { id: 'MB', label: 'MB', tooltip: 'Defeated', hpThreshold: 0, defeated: true }
    ]
  },
  abilities: [],
  dotSystems: [],
  match: { formats: ['best_of_1', 'best_of_3', 'best_of_5'], defaultFormat: 'best_of_1' },
  ui: { theme: 'dark_fantasy', colors: { primary: '#c0392b', secondary: '#7c3aed', accent: '#c9a227' } }
};

const SECTIONS = [
  { id: 'basic',    label: '📝 Basic Info' },
  { id: 'players',  label: '❤️ Players & HP' },
  { id: 'combat',   label: '⚔️ Dice & Combat' },
  { id: 'statuses', label: '📊 Statuses' },
  { id: 'abilities',label: '✨ Abilities' },
  { id: 'dot',      label: '🔴 Damage Over Time' },
  { id: 'format',   label: '🏆 Match Format' },
  { id: 'theme',    label: '🎨 Visual Theme' },
];

// ── Mini preview of the battle screen ──────────────────────────────────────
function LivePreview({ preset }) {
  const p = preset;
  const hp = p.players.startingHp;
  const statuses = p.statuses.list.filter(s => !s.protectionOn && !s.protectionOff);

  const STATUS_COLORS = {
    A: 'border-pink-400 text-pink-400',
    H: 'border-fuchsia-400 text-fuchsia-400',
    AD: 'border-red-500 text-red-400',
    MB: 'bg-red-600 border-red-600 text-black',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-lg"
         style={{ background: '#0a0a0f', border: '1px solid #2a2a3a' }}>

      {/* Mini topbar */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0"
           style={{ background: '#0f0f18', borderBottom: '1px solid #2a2a3a' }}>
        <span className="font-mono text-xs text-[#5a5650]">PREVIEW</span>
        <span className="font-mono text-xs font-bold" style={{ color: p.ui.colors.accent }}>
          {p.meta.icon} {p.meta.name}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden p-2 gap-2">

        {/* Player panels */}
        {['Attacker', 'Defender'].map((role, i) => (
          <div key={role} className="flex-1 rounded p-2 flex flex-col gap-1.5"
               style={{ background: '#0f0f18', border: '1px solid #2a2a3a' }}>
            <div className="text-xs font-bold text-[#e8e4d6]">{role}</div>
            <div className="text-xs text-[#5a5650] font-mono">{role.toUpperCase()}</div>
            <div>
              <div className="text-lg font-bold font-mono" style={{ color: '#22c55e' }}>{hp}</div>
              <div className="h-2 rounded-full overflow-hidden mt-1" style={{ background: '#13131f' }}>
                <div className="h-full rounded-full" style={{ width: '100%', background: '#22c55e' }} />
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 rounded-full border border-gray-600 text-gray-400">
                {p.statuses.list.find(s => s.protectionOn)?.label || 'N'}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full border border-sky-500 text-sky-400">
                🛡 ON
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons preview */}
      <div className="px-2 pb-2 space-y-1">
        <div className="text-center text-xs font-mono tracking-widest py-1"
             style={{ color: p.ui.colors.accent }}>⚔️ YOUR ATTACK TURN</div>
        <button className="w-full py-1.5 rounded text-xs font-mono text-white"
                style={{ background: `linear-gradient(135deg, #7f1d1d, ${p.ui.colors.primary})` }}>
          ⚔️ Attack
        </button>
        {p.abilities.filter(a => a.availableTo?.includes('attacker')).map(ab => (
          <button key={ab.id} className="w-full py-1.5 rounded text-xs font-mono"
                  style={{ border: `1px solid ${p.ui.colors.secondary}`, color: p.ui.colors.secondary }}>
            {ab.icon} {ab.label}
          </button>
        ))}
      </div>

      {/* Status list */}
      {statuses.length > 0 && (
        <div className="px-2 pb-2">
          <div className="text-xs text-[#5a5650] font-mono mb-1">STATUS PROGRESSION</div>
          <div className="flex gap-1 flex-wrap">
            {statuses.map(s => (
              <span key={s.id} className={`text-xs font-mono px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.id] || 'border-gray-600 text-gray-400'}`}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section editors ─────────────────────────────────────────────────────────

function BasicSection({ preset, update }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-yellow-400 font-mono tracking-widest">BASIC INFO</h3>
      <div>
        <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">GAME ICON</label>
        <input className="w-20 px-3 py-2 rounded text-center text-2xl bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
          value={preset.meta.icon}
          onChange={e => update('meta.icon', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">GAME NAME</label>
        <input className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
          value={preset.meta.name}
          onChange={e => update('meta.name', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">DESCRIPTION</label>
        <textarea rows={3} className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600 resize-none"
          value={preset.meta.description}
          onChange={e => update('meta.description', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">ROLE 1 NAME</label>
          <input className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
            value={preset.meta.roles[0]}
            onChange={e => { const r = [...preset.meta.roles]; r[0] = e.target.value; update('meta.roles', r); }} />
        </div>
        <div>
          <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">ROLE 2 NAME</label>
          <input className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
            value={preset.meta.roles[1]}
            onChange={e => { const r = [...preset.meta.roles]; r[1] = e.target.value; update('meta.roles', r); }} />
        </div>
      </div>
    </div>
  );
}

function PlayersSection({ preset, update }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-yellow-400 font-mono tracking-widest">PLAYERS & HP</h3>
      <div>
        <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">STARTING HP</label>
        <input type="number" min={10} max={9999}
          className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
          value={preset.players.startingHp}
          onChange={e => update('players.startingHp', parseInt(e.target.value) || 100)} />
        <p className="text-xs text-[#5a5650] mt-1">Both players start with this HP. Status thresholds are calculated as percentages of this value.</p>
      </div>
    </div>
  );
}

function CombatSection({ preset, update }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-yellow-400 font-mono tracking-widest">DICE & COMBAT</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">DEFAULT DICE</label>
          <select className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
            value={preset.dice.defaultFaces}
            onChange={e => update('dice.defaultFaces', parseInt(e.target.value))}>
            {[4,6,8,10,12,20].map(f => <option key={f} value={f}>d{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">DAMAGE PER HIT</label>
          <input type="number" min={1} max={9999}
            className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
            value={preset.combat.damage}
            onChange={e => update('combat.damage', parseInt(e.target.value) || 25)} />
        </div>
        <div>
          <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">COOLDOWN (SECONDS)</label>
          <input type="number" min={5} max={1800}
            className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
            value={preset.combat.attackCooldownSeconds}
            onChange={e => update('combat.attackCooldownSeconds', parseInt(e.target.value) || 30)} />
        </div>
        <div>
          <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">TIE RULE</label>
          <select className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
            value={preset.combat.tieRule}
            onChange={e => update('combat.tieRule', e.target.value)}>
            <option value="attacker_wins">Attacker wins ties</option>
            <option value="defender_wins">Defender wins ties</option>
            <option value="reroll">Reroll on tie</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function StatusesSection({ preset, update }) {
  const statuses = preset.statuses.list;

  const updateStatus = (idx, field, value) => {
    const list = [...statuses];
    list[idx] = { ...list[idx], [field]: value };
    update('statuses.list', list);
  };

  const addStatus = () => {
    const list = [...statuses, { id: `S${statuses.length}`, label: `S${statuses.length}`, tooltip: '', hpThreshold: 0.5 }];
    update('statuses.list', list);
  };

  const removeStatus = (idx) => {
    const list = statuses.filter((_, i) => i !== idx);
    update('statuses.list', list);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-yellow-400 font-mono tracking-widest">STATUSES</h3>
        <button onClick={addStatus}
          className="text-xs px-3 py-1 rounded font-mono border border-yellow-700 text-yellow-600 hover:border-yellow-500 hover:text-yellow-400 transition-all">
          + Add Status
        </button>
      </div>
      <p className="text-xs text-[#5a5650]">Statuses progress when HP drops below thresholds. Drag to reorder (coming soon).</p>
      <div className="space-y-2">
        {statuses.map((s, idx) => (
          <div key={idx} className="rounded p-3 space-y-2" style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>
            <div className="flex items-center gap-2">
              <input placeholder="ID" className="w-16 px-2 py-1 rounded text-xs font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
                value={s.id} onChange={e => updateStatus(idx, 'id', e.target.value)} />
              <input placeholder="Label" className="w-16 px-2 py-1 rounded text-xs font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
                value={s.label} onChange={e => updateStatus(idx, 'label', e.target.value)} />
              <input placeholder="Tooltip" className="flex-1 px-2 py-1 rounded text-xs font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
                value={s.tooltip || ''} onChange={e => updateStatus(idx, 'tooltip', e.target.value)} />
              <button onClick={() => removeStatus(idx)} className="text-red-700 hover:text-red-500 text-xs font-mono px-1">✕</button>
            </div>
            <div className="flex gap-3 flex-wrap text-xs">
              {s.hpThreshold !== undefined && (
                <label className="flex items-center gap-1 text-[#9a9680]">
                  HP threshold:
                  <input type="number" min={0} max={1} step={0.05}
                    className="w-16 px-1 py-0.5 rounded font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none"
                    value={s.hpThreshold}
                    onChange={e => updateStatus(idx, 'hpThreshold', parseFloat(e.target.value))} />
                  <span className="text-[#5a5650]">({Math.round((s.hpThreshold||0)*100)}%)</span>
                </label>
              )}
              {s.dicePenalty !== undefined && (
                <label className="flex items-center gap-1 text-[#9a9680]">
                  Dice penalty:
                  <input type="number" min={-10} max={0}
                    className="w-12 px-1 py-0.5 rounded font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none"
                    value={s.dicePenalty}
                    onChange={e => updateStatus(idx, 'dicePenalty', parseInt(e.target.value))} />
                </label>
              )}
              <label className="flex items-center gap-1 text-[#9a9680]">
                <input type="checkbox" checked={!!s.defeated} onChange={e => updateStatus(idx, 'defeated', e.target.checked)} />
                Defeated
              </label>
              <label className="flex items-center gap-1 text-[#9a9680]">
                <input type="checkbox" checked={!!s.protectionOn} onChange={e => updateStatus(idx, 'protectionOn', e.target.checked)} />
                Protection ON start
              </label>
              <label className="flex items-center gap-1 text-[#9a9680]">
                <input type="checkbox" checked={!!s.protectionOff} onChange={e => updateStatus(idx, 'protectionOff', e.target.checked)} />
                Protection OFF start
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AbilitiesSection({ preset, update }) {
  const abilities = preset.abilities;

  const updateAbility = (idx, field, value) => {
    const list = [...abilities];
    list[idx] = { ...list[idx], [field]: value };
    update('abilities', list);
  };

  const addAbility = () => {
    update('abilities', [...abilities, {
      id: `ABILITY_${abilities.length + 1}`,
      label: 'New Ability',
      icon: '⚡',
      availableTo: ['attacker'],
      usesPerMatch: 1,
      requiresRoll: true,
      successCondition: { type: 'exact', value: 6 },
      effect: { type: 'instant_damage', damage: 10 }
    }]);
  };

  const removeAbility = (idx) => update('abilities', abilities.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-yellow-400 font-mono tracking-widest">ABILITIES</h3>
        <button onClick={addAbility}
          className="text-xs px-3 py-1 rounded font-mono border border-yellow-700 text-yellow-600 hover:border-yellow-500 hover:text-yellow-400 transition-all">
          + Add Ability
        </button>
      </div>
      <div className="space-y-3">
        {abilities.map((ab, idx) => (
          <div key={idx} className="rounded p-3 space-y-2" style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>
            <div className="flex items-center gap-2">
              <input placeholder="Icon" className="w-10 px-1 py-1 rounded text-center text-lg bg-[#0f0f18] border border-[#2a2a3a] focus:outline-none"
                value={ab.icon} onChange={e => updateAbility(idx, 'icon', e.target.value)} />
              <input placeholder="Label" className="flex-1 px-2 py-1 rounded text-xs font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
                value={ab.label} onChange={e => updateAbility(idx, 'label', e.target.value)} />
              <select className="px-2 py-1 rounded text-xs font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none"
                value={ab.availableTo?.[0] || 'attacker'}
                onChange={e => updateAbility(idx, 'availableTo', [e.target.value])}>
                <option value="attacker">Attacker</option>
                <option value="defender">Defender</option>
              </select>
              <button onClick={() => removeAbility(idx)} className="text-red-700 hover:text-red-500 text-xs font-mono px-1">✕</button>
            </div>
            <div className="flex gap-3 flex-wrap text-xs text-[#9a9680]">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={ab.requiresRoll} onChange={e => updateAbility(idx, 'requiresRoll', e.target.checked)} />
                Requires roll
              </label>
              {ab.requiresRoll && (
                <label className="flex items-center gap-1">
                  Success on roll =
                  <input type="number" min={1} max={20}
                    className="w-12 px-1 py-0.5 rounded font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none"
                    value={ab.successCondition?.value || 6}
                    onChange={e => updateAbility(idx, 'successCondition', { type: 'exact', value: parseInt(e.target.value) })} />
                </label>
              )}
              <label className="flex items-center gap-1">
                Uses per match:
                <input type="number" min={1} max={99}
                  className="w-12 px-1 py-0.5 rounded font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none"
                  value={ab.usesPerMatch || 1}
                  onChange={e => updateAbility(idx, 'usesPerMatch', parseInt(e.target.value))} />
              </label>
            </div>
          </div>
        ))}
        {abilities.length === 0 && (
          <div className="text-center text-xs text-[#5a5650] font-mono py-4">No abilities yet. Click + Add Ability.</div>
        )}
      </div>
    </div>
  );
}

function ThemeSection({ preset, update }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-yellow-400 font-mono tracking-widest">VISUAL THEME</h3>
      <div className="grid grid-cols-3 gap-3">
        {[['primary','Primary Color'],['secondary','Secondary Color'],['accent','Accent Color']].map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-1">{label.toUpperCase()}</label>
            <div className="flex items-center gap-2">
              <input type="color"
                className="w-10 h-9 rounded cursor-pointer bg-transparent border-0"
                value={preset.ui.colors[key]}
                onChange={e => update(`ui.colors.${key}`, e.target.value)} />
              <span className="text-xs font-mono text-[#9a9680]">{preset.ui.colors[key]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function DoTSection({ preset, update }) {
  const dots = preset.dotSystems || [];

  const updateDot = (idx, field, value) => {
    const list = [...dots];
    list[idx] = { ...list[idx], [field]: value };
    update('dotSystems', list);
  };

  const addDot = () => {
    update('dotSystems', [...dots, {
      id: `dot_${dots.length + 1}`,
      label: 'New DoT',
      trigger: 'protection_off_at_start',
      targets: 'both',
      damagePerTick: 5,
      intervalMinutes: 5,
      message: '{target} lost {damage} HP'
    }]);
  };

  const removeDot = (idx) => update('dotSystems', dots.filter((_, i) => i !== idx));

  const inp = "px-2 py-1 rounded text-xs font-mono bg-[#0f0f18] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-yellow-400 font-mono tracking-widest">DAMAGE OVER TIME</h3>
        <button onClick={addDot}
          className="text-xs px-3 py-1 rounded font-mono border border-yellow-700 text-yellow-600 hover:border-yellow-500 hover:text-yellow-400 transition-all">
          + Add DoT
        </button>
      </div>
      <p className="text-xs text-[#5a5650]">Automatic recurring damage triggered by game events.</p>
      <div className="space-y-3">
        {dots.map((dot, idx) => (
          <div key={idx} className="rounded p-3 space-y-2" style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>
            <div className="flex items-center gap-2">
              <input placeholder="Name" className={inp + " flex-1"}
                value={dot.label} onChange={e => updateDot(idx, 'label', e.target.value)} />
              <button onClick={() => removeDot(idx)} className="text-red-700 hover:text-red-500 text-xs font-mono px-1">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[#5a5650] mb-1">TRIGGER</label>
                <select className={inp + " w-full"}
                  value={dot.trigger} onChange={e => updateDot(idx, 'trigger', e.target.value)}>
                  <option value="protection_off_at_start">Protection OFF at start</option>
                  <option value="bc_ability_success">BC Curse success</option>
                  <option value="match_start">Match start</option>
                </select>
              </div>
              <div>
                <label className="block text-[#5a5650] mb-1">TARGETS</label>
                <select className={inp + " w-full"}
                  value={dot.targets} onChange={e => updateDot(idx, 'targets', e.target.value)}>
                  <option value="both">Both players</option>
                  <option value="defender">Defender only</option>
                  <option value="attacker">Attacker only</option>
                </select>
              </div>
              <div>
                <label className="block text-[#5a5650] mb-1">DAMAGE / TICK</label>
                <input type="number" min={1} max={999} className={inp + " w-full"}
                  value={dot.damagePerTick} onChange={e => updateDot(idx, 'damagePerTick', parseInt(e.target.value) || 5)} />
              </div>
              <div>
                <label className="block text-[#5a5650] mb-1">INTERVAL (MIN)</label>
                <input type="number" min={0.1} max={60} step={0.5} className={inp + " w-full"}
                  value={dot.intervalMinutes} onChange={e => updateDot(idx, 'intervalMinutes', parseFloat(e.target.value) || 5)} />
              </div>
            </div>
            <div>
              <label className="block text-[#5a5650] text-xs mb-1">LOG MESSAGE</label>
              <input placeholder="{target} lost {damage} HP" className={inp + " w-full"}
                value={dot.message || ''} onChange={e => updateDot(idx, 'message', e.target.value)} />
              <p className="text-xs text-[#3a3a4a] mt-0.5">Use {"{target}"} and {"{damage}"} as placeholders.</p>
            </div>
          </div>
        ))}
        {dots.length === 0 && (
          <div className="text-center text-xs text-[#5a5650] font-mono py-4">No DoT systems. Click + Add DoT.</div>
        )}
      </div>
    </div>
  );
}

function FormatSection({ preset, update }) {
  const formats = [
    { id: 'best_of_1', label: 'Best of 1' },
    { id: 'best_of_3', label: 'Best of 3' },
    { id: 'best_of_5', label: 'Best of 5' },
    { id: 'best_of_7', label: 'Best of 7' },
    { id: 'custom',    label: 'Custom' },
  ];
  const enabled = preset.match?.formats || ['best_of_1'];
  const defaultFmt = preset.match?.defaultFormat || 'best_of_1';

  const toggleFormat = (id) => {
    const next = enabled.includes(id) ? enabled.filter(f => f !== id) : [...enabled, id];
    if (next.length === 0) return;
    update('match.formats', next);
    if (!next.includes(defaultFmt)) update('match.defaultFormat', next[0]);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-yellow-400 font-mono tracking-widest">MATCH FORMAT</h3>
      <div>
        <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-2">AVAILABLE FORMATS</label>
        <div className="space-y-1">
          {formats.map(f => (
            <button key={f.id} onClick={() => toggleFormat(f.id)}
              className="w-full text-left px-3 py-2 rounded text-xs font-mono border transition-all flex items-center gap-2"
              style={enabled.includes(f.id)
                ? { border: '1px solid #c9a227', color: '#f4c842', background: 'rgba(201,162,39,0.08)' }
                : { border: '1px solid #2a2a3a', color: '#5a5650' }}>
              <span>{enabled.includes(f.id) ? '✓' : '○'}</span>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#9a9680] font-mono tracking-widest mb-2">DEFAULT FORMAT</label>
        <select
          className="w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600"
          value={defaultFmt}
          onChange={e => update('match.defaultFormat', e.target.value)}>
          {enabled.map(id => (
            <option key={id} value={id}>{formats.find(f => f.id === id)?.label || id}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Deep set helper ─────────────────────────────────────────────────────────
function deepSet(obj, path, value) {
  const keys = path.split('.');
  const result = JSON.parse(JSON.stringify(obj));
  let cur = result;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
  cur[keys[keys.length - 1]] = value;
  return result;
}

// ── Main Builder Screen ─────────────────────────────────────────────────────
export default function BuilderScreen({ onBack, onPlay }) {
  const [preset, setPreset] = useState(() => {
    try {
      const saved = localStorage.getItem('duel-engine-builder-preset');
      return saved ? JSON.parse(saved) : DEFAULT_PRESET;
    } catch { return DEFAULT_PRESET; }
  });
  const [activeSection, setActiveSection] = useState('basic');

  const update = (path, value) => {
    setPreset(prev => {
      const next = deepSet(prev, path, value);
      localStorage.setItem('duel-engine-builder-preset', JSON.stringify(next));
      return next;
    });
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${preset.meta.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
  };

  const importJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (!parsed.meta || !parsed.players || !parsed.combat) {
            alert('Invalid preset file. Make sure it was exported from the Rule Builder.');
            return;
          }
          setPreset(parsed);
          localStorage.setItem('duel-engine-builder-preset', JSON.stringify(parsed));
          alert('Preset loaded: ' + (parsed.meta.name || 'Unknown'));
        } catch {
          alert('Failed to read file. Make sure it is a valid JSON preset.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const resetPreset = () => {
    if (confirm('Reset to default? This will clear all your changes.')) {
      setPreset(DEFAULT_PRESET);
      localStorage.removeItem('duel-engine-builder-preset');
    }
  };

  const sections = {
    basic:     <BasicSection preset={preset} update={update} />,
    players:   <PlayersSection preset={preset} update={update} />,
    combat:    <CombatSection preset={preset} update={update} />,
    statuses:  <StatusesSection preset={preset} update={update} />,
    abilities: <AbilitiesSection preset={preset} update={update} />,
    dot:       <DoTSection preset={preset} update={update} />,
    format:    <FormatSection preset={preset} update={update} />,
    theme:     <ThemeSection preset={preset} update={update} />,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0a0f' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0"
           style={{ background: '#0f0f18', borderBottom: '1px solid #2a2a3a' }}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-xs text-[#5a5650] hover:text-yellow-400 font-mono transition-all">← BACK</button>
          <span className="text-yellow-400 font-mono font-bold tracking-widest text-sm">RULE BUILDER</span>
          <span className="text-xs text-[#5a5650] font-mono">Auto-saved</span>
        </div>
        <div className="flex gap-2">
          <button onClick={resetPreset}
            className="text-xs px-3 py-1.5 rounded font-mono border border-[#2a2a3a] text-[#5a5650] hover:border-red-800 hover:text-red-600 transition-all">
            Reset
          </button>
          <button onClick={exportJSON}
            className="text-xs px-3 py-1.5 rounded font-mono border border-yellow-700 text-yellow-600 hover:border-yellow-500 hover:text-yellow-400 transition-all">
            Export JSON
          </button>
          <button
            className="text-xs px-4 py-1.5 rounded font-mono text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#7f1d1d,#c0392b)' }}
            onClick={() => onPlay && onPlay(preset)}>
            ▶ Play Now
          </button>
        </div>
      </div>

      {/* Body: sidebar + editor + preview */}
      <div className="flex flex-1 overflow-hidden">

        {/* Section nav */}
        <div className="shrink-0 py-4 flex flex-col gap-1"
             style={{ width: '180px', borderRight: '1px solid #2a2a3a', background: '#0f0f18' }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`text-left px-4 py-2 text-xs font-mono transition-all ${
                activeSection === s.id
                  ? 'text-yellow-400 bg-yellow-400/10 border-r-2 border-yellow-400'
                  : 'text-[#5a5650] hover:text-[#9a9680]'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-6" style={{ maxWidth: '480px' }}>
          {sections[activeSection] || (
            <div className="text-center text-xs text-[#5a5650] font-mono py-8">Coming soon...</div>
          )}
        </div>

        {/* Live preview */}
        <div className="flex-1 p-4 overflow-hidden" style={{ borderLeft: '1px solid #2a2a3a' }}>
          <div className="text-xs text-[#5a5650] font-mono tracking-widest mb-2">LIVE PREVIEW</div>
          <div style={{ height: 'calc(100% - 24px)' }}>
            <LivePreview preset={preset} />
          </div>
        </div>
      </div>
    </div>
  );
}
