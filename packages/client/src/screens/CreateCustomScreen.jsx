import { useState } from 'react';
import socket from '../socket/client';

export default function CreateCustomScreen({ preset, onBack }) {
  const [name, setName] = useState('');
  const [bestOf, setBestOf] = useState(1);
  const [role, setRole] = useState('defender');
  const [protection, setProtection] = useState(
    preset?.protection?.enabled !== false
  );

  const play = () => {
    if (!name.trim()) return alert('Enter your name');
    socket.emit('create_room', {
      creatorRole: role,
      presetId: 'custom',
      playerName: name.trim(),
      customPreset: preset,
      settings: {
        bestOf: parseInt(bestOf),
        protectionEnabled: protection,
        cooldownSeconds: preset?.combat?.attackCooldownSeconds || 30,
        startingHp: preset?.players?.startingHp || 100,
        damage: preset?.combat?.damage || 25
      }
    });
  };

  const inp = "w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600";

  return (
    <div className="screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-sm text-[#5a5650] hover:text-yellow-500 mb-4 font-mono">← BACK TO BUILDER</button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{preset?.meta?.icon || '⚔️'}</div>
          <h2 className="text-2xl font-bold tracking-[4px] text-yellow-400">{preset?.meta?.name || 'Custom Game'}</h2>
          {preset?.meta?.description && (
            <p className="text-sm text-[#9a9680] mt-1">{preset.meta.description}</p>
          )}
        </div>

        <div className="rounded-lg p-6 space-y-4" style={{ background: '#0f0f18', border: '1px solid #2a2a3a' }}>
          <div>
            <label className="block text-xs tracking-widest text-[#9a9680] mb-1">YOUR NAME</label>
            <input className={inp} placeholder="Enter your name" maxLength={20}
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && play()} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs tracking-widest text-[#9a9680] mb-1">MATCH FORMAT</label>
              <select className={inp} value={bestOf} onChange={e => setBestOf(e.target.value)}>
                <option value={1}>Best of 1</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
                <option value={7}>Best of 7</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="block text-xs tracking-widest text-[#9a9680] mb-1">PROTECTION</label>
              <button onClick={() => setProtection(p => !p)}
                className={`px-4 py-2 rounded text-xs font-mono border transition-all ${
                  protection ? 'border-sky-400 text-sky-400 bg-sky-400/10' : 'border-[#2a2a3a] text-[#5a5650]'
                }`}>
                {protection ? '🛡 ON' : '❌ OFF'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs tracking-widest text-[#9a9680] mb-2">YOUR ROLE</label>
            <div className="grid grid-cols-2 gap-2">
              {[['defender','🛡 Defender'],['attacker','⚔️ Attacker']].map(([r, label]) => (
                <button key={r} onClick={() => setRole(r)}
                  className={`py-2 rounded text-xs font-mono border transition-all ${
                    role === r
                      ? r === 'defender'
                        ? 'border-sky-400 text-sky-400 bg-sky-400/10'
                        : 'border-red-500 text-red-400 bg-red-500/10'
                      : 'border-[#2a2a3a] text-[#5a5650]'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Preset summary */}
          <div className="rounded p-3 space-y-1" style={{ background: '#13131f', border: '1px solid #1a1a2a' }}>
            <div className="text-xs text-[#5a5650] font-mono tracking-widest mb-2">GAME RULES</div>
            {[
              ['HP', preset?.players?.startingHp || 100],
              ['Damage', preset?.combat?.damage || 25],
              ['Dice', `d${preset?.dice?.defaultFaces || 6}`],
              ['Cooldown', `${preset?.combat?.attackCooldownSeconds || 30}s`],
              ['Abilities', (preset?.abilities?.length || 0)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs font-mono">
                <span className="text-[#5a5650]">{k}</span>
                <span className="text-yellow-700">{v}</span>
              </div>
            ))}
          </div>

          <button onClick={play}
            className="w-full py-3 rounded font-mono tracking-wider text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#8b1a1a,#c0392b)', boxShadow: '0 0 15px #c0392b44' }}>
            ▶ PLAY {preset?.meta?.name?.toUpperCase() || 'CUSTOM GAME'}
          </button>
        </div>
      </div>
    </div>
  );
}
