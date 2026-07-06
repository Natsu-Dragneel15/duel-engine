import { useState } from 'react';
import socket from '../socket/client';
import useGameStore from '../store/gameStore';

export default function LobbyScreen() {
  const { roomCode, isOwner, gameState } = useGameStore();
  const [ready, setReady] = useState(false);

  if (!gameState) return <div className="screen flex items-center justify-center text-[#5a5650] font-mono">Connecting...</div>;

  const { me, opponent, settings } = gameState;

  const toggleReady = () => {
    const next = !ready;
    setReady(next);
    socket.emit('set_ready', { ready: next });
  };

  const startMatch = () => socket.emit('start_match');

  const bothReady = me?.ready && opponent?.ready;

  return (
    <div className="screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h2 className="text-2xl font-bold tracking-[4px] text-yellow-400 mb-2 text-center">WAR CHAMBER</h2>

        {/* Room code */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-[#5a5650] text-xs tracking-widest font-mono">ROOM CODE</span>
          <span className="text-2xl tracking-[6px] font-mono text-yellow-400"
                style={{ textShadow: '0 0 10px #c9a22766' }}>{roomCode}</span>
          <button onClick={() => navigator.clipboard.writeText(roomCode)}
            className="text-xs text-[#5a5650] hover:text-yellow-400 border border-[#2a2a3a] px-2 py-0.5 rounded font-mono">
            COPY
          </button>
        </div>

        {/* Players */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: 'DEFENDER', data: me?.role === 'defender' ? me : opponent },
            { label: 'ATTACKER', data: me?.role === 'attacker' ? me : opponent }
          ].map(({ label, data }) => (
            <div key={label} className="rounded-lg p-4 text-center" style={{ background: '#0f0f18', border: '1px solid #2a2a3a' }}>
              <div className="text-xs tracking-widest text-[#5a5650] font-mono mb-2">{label}</div>
              <div className="text-lg font-bold text-[#e8e4d6] mb-2">{data?.name || 'Waiting...'}</div>
              <div className={`text-xs font-mono px-2 py-0.5 rounded-full border inline-block ${
                data?.ready ? 'border-green-500 text-green-400' : 'border-[#2a2a3a] text-[#5a5650]'
              }`}>
                {data?.ready ? 'READY' : 'NOT READY'}
              </div>
            </div>
          ))}
        </div>

        {/* Settings preview */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            ['FORMAT',   `Best of ${settings?.bestOf || 1}`],
            ['SHIELD',   settings?.protectionEnabled ? '🛡 ON' : '❌ OFF'],
            ['COOLDOWN', `${settings?.cooldownSeconds || 120}s`],
          ].map(([k, v]) => (
            <div key={k} className="text-center rounded p-2" style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>
              <div className="text-yellow-400 font-mono text-sm font-bold">{v}</div>
              <div className="text-[#5a5650] text-xs tracking-widest font-mono">{k}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button onClick={toggleReady}
            className={`px-6 py-2 rounded font-mono tracking-wider border transition-all hover:-translate-y-0.5 ${
              ready ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-yellow-600 text-yellow-400 bg-yellow-600/10'
            }`}>
            {ready ? '✅ READY!' : '⚡ READY UP'}
          </button>
          {isOwner && bothReady && (
            <button onClick={startMatch}
              className="px-6 py-2 rounded font-mono tracking-wider text-white transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg,#8b1a1a,#c0392b)', boxShadow: '0 0 15px #c0392b44' }}>
              ⚔️ START BATTLE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
