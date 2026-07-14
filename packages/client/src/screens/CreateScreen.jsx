import { useState } from 'react';
import socket from '../socket/client';

export default function CreateScreen({ onBack }) {
  const [name, setName]             = useState('');
  const [bestOf, setBestOf]         = useState(1);
  const [protection, setProtection] = useState(true);
  const [cooldown, setCooldown]     = useState(10);
  const [prize, setPrize]           = useState('');
  const [hp, setHp]                 = useState(100);
  const [damage, setDamage]         = useState(25);
  const [role, setRole]             = useState('defender');

  const create = () => {
    if (!name.trim()) return alert('Enter your name');
    socket.emit('create_room', {
      presetId: 'shadow-duel',
      playerName: name.trim(),
      creatorRole: role,
      settings: {
        bestOf:            parseInt(bestOf),
        protectionEnabled: protection,
        cooldownSeconds:   parseInt(cooldown),
        prize,
        startingHp:        parseInt(hp),
        damage:            parseInt(damage)
      }
    });
  };

  const inp = "w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600";

  return (
    <div className="screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-sm text-[#5a5650] hover:text-yellow-500 mb-4 font-mono">← BACK</button>
        <h2 className="text-2xl font-bold tracking-[4px] text-yellow-400 mb-6 text-center">CREATE MATCH</h2>
        <div className="rounded-lg p-6 space-y-4" style={{ background: '#0f0f18', border: '1px solid #2a2a3a' }}>

          <div>
            <label className="block text-xs tracking-widest text-[#9a9680] mb-1">YOUR NAME</label>
            <input className={inp} placeholder="Enter your name" maxLength={20}
              value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
          </div>

          <div>
            <label className="block text-xs tracking-widest text-[#9a9680] mb-2">YOUR ROLE</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setRole('defender')}
                className="py-2 rounded text-xs font-mono border transition-all"
                style={role === 'defender'
                  ? { border: '1px solid #38bdf8', color: '#38bdf8', background: 'rgba(56,189,248,0.1)' }
                  : { border: '1px solid #2a2a3a', color: '#5a5650' }}>
                🛡 Defender (Owner)
              </button>
              <button onClick={() => setRole('attacker')}
                className="py-2 rounded text-xs font-mono border transition-all"
                style={role === 'attacker'
                  ? { border: '1px solid #ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }
                  : { border: '1px solid #2a2a3a', color: '#5a5650' }}>
                ⚔️ Attacker
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs tracking-widest text-[#9a9680] mb-1">PRIZE / STAKE</label>
            <input className={inp} placeholder="What's on the line?" maxLength={100}
              value={prize} onChange={e => setPrize(e.target.value)} />
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
            <div>
              <label className="block text-xs tracking-widest text-[#9a9680] mb-1">COOLDOWN (SEC)</label>
              <input className={inp} type="number" min={5} max={1800}
                value={cooldown} onChange={e => setCooldown(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs tracking-widest text-[#9a9680] mb-1">MAX HP</label>
              <input className={inp} type="number" min={10} max={1000}
                value={hp} onChange={e => setHp(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs tracking-widest text-[#9a9680] mb-1">DAMAGE PER HIT</label>
              <input className={inp} type="number" min={1} max={500}
                value={damage} onChange={e => setDamage(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs tracking-widest text-[#9a9680]">PROTECTION</label>
            <button onClick={() => setProtection(p => !p)}
              className="px-4 py-1 rounded text-xs font-mono border transition-all"
              style={protection
                ? { border: '1px solid #38bdf8', color: '#38bdf8', background: 'rgba(56,189,248,0.1)' }
                : { border: '1px solid #2a2a3a', color: '#5a5650' }}>
              {protection ? '🛡 ON → Status N' : '❌ OFF → Status R'}
            </button>
          </div>

          <button onClick={create}
            className="w-full py-3 rounded font-mono tracking-wider text-white transition-all hover:-translate-y-0.5 mt-2"
            style={{ background: 'linear-gradient(135deg,#8b1a1a,#c0392b)', boxShadow: '0 0 15px #c0392b44' }}>
            🏰 CREATE MATCH
          </button>
        </div>
      </div>
    </div>
  );
}
