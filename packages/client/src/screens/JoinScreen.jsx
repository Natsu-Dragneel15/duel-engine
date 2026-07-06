import { useState } from 'react';
import socket from '../socket/client';

export default function JoinScreen({ onBack }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const join = () => {
    if (!name.trim()) return alert('Enter your name');
    if (!code.trim()) return alert('Enter room code');
    socket.emit('join_room', { playerName: name.trim(), code: code.trim().toUpperCase() });
  };

  const inp = "w-full px-3 py-2 rounded text-sm font-mono bg-[#13131f] border border-[#2a2a3a] text-[#e8e4d6] focus:outline-none focus:border-yellow-600";

  return (
    <div className="screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-sm text-[#5a5650] hover:text-yellow-500 mb-4 font-mono">← BACK</button>
        <h2 className="text-2xl font-bold tracking-[4px] text-yellow-400 mb-6 text-center">JOIN MATCH</h2>
        <div className="rounded-lg p-6 space-y-4" style={{ background: '#0f0f18', border: '1px solid #2a2a3a' }}>
          <div>
            <label className="block text-xs tracking-widest text-[#9a9680] mb-1">YOUR NAME</label>
            <input className={inp} placeholder="Enter your name" maxLength={20}
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs tracking-widest text-[#9a9680] mb-1">ROOM CODE</label>
            <input className={`${inp} text-center text-2xl tracking-[8px]`}
              placeholder="ABC123" maxLength={8}
              value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && join()} />
          </div>
          <button onClick={join}
            className="w-full py-3 rounded font-mono tracking-wider transition-all hover:-translate-y-0.5"
            style={{ border: '1px solid #c9a227', color: '#f4c842', background: 'rgba(201,162,39,0.1)' }}>
            ⚔️ ENTER THE ARENA
          </button>
        </div>
      </div>
    </div>
  );
}
