import React, { useEffect, useRef } from 'react';
import socket from '../socket/client';
import useGameStore from '../store/gameStore';
import HPBar from '../components/HPBar';
import StatusBadge from '../components/StatusBadge';
import BattleLog from '../components/BattleLog';

function MatchTimer({ startedAt }) {
  const [elapsed, setElapsed] = React.useState(0);
  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Date.now() - startedAt);
    const interval = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const totalSecs = Math.floor(elapsed / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = String(totalSecs % 60).padStart(2, '0');
  return <span className="font-mono text-xs text-yellow-700 tracking-widest">{m}:{s}</span>;
}

function PlayerPanel({ player, hypnoSkips }) {
  if (!player) return (
    <div className="flex-1 rounded-lg p-3" style={{ background: '#0f0f18', border: '1px solid #2a2a3a' }} />
  );
  const hpColor = player.hp > 50 ? '#22c55e' : player.hp > 25 ? '#eab308' : '#ef4444';
  const isDefeated = player.status === 'MB';
  return (
    <div className="flex-1 rounded-lg p-3 flex flex-col gap-2 relative overflow-hidden"
         style={{ background: '#0f0f18', border: `1px solid ${isDefeated ? '#7f1d1d' : '#2a2a3a'}` }}>
      <div>
        <div className="font-bold text-sm text-[#e8e4d6] truncate">{player.name}</div>
        <div className="text-xs tracking-widest text-[#5a5650] font-mono">{player.role?.toUpperCase()}</div>
      </div>
      <div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-2xl font-bold font-mono" style={{ color: hpColor }}>{player.hp}</span>
          <span className="text-[#5a5650] font-mono text-xs">/ {player.maxHp}</span>
        </div>
        <HPBar hp={player.hp} maxHp={player.maxHp} />
      </div>
      <div className="flex gap-1 flex-wrap">
        <StatusBadge status={player.status} />
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
          player.protection ? 'border-sky-500 text-sky-400 bg-sky-500/10' : 'border-[#2a2a3a] text-[#5a5650]'
        }`}>{player.protection ? '🛡 ON' : '🛡 OFF'}</span>
      </div>
      {hypnoSkips > 0 && (
        <div className="text-xs font-mono px-2 py-1 rounded border border-purple-500 text-purple-400 bg-purple-500/10 text-center">
          🌀 HYPNO · {hypnoSkips} skip{hypnoSkips > 1 ? 's' : ''} left
        </div>
      )}
      <div className="text-xs text-[#5a5650] font-mono space-y-0.5 mt-auto pt-2 border-t border-[#1a1a2a]">
        {[['ATK', player.stats?.attacks||0],['HIT', player.stats?.hits||0],['DMG', player.stats?.damageDealt||0],['RCV', player.stats?.damageReceived||0]].map(([k,v]) => (
          <div key={k} className="flex justify-between"><span>{k}</span><span className="text-yellow-700">{v}</span></div>
        ))}
      </div>
      {isDefeated && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
          <span className="text-red-500 font-bold tracking-[6px] font-mono text-sm rotate-[-12deg] border border-red-800 px-3 py-1">DEFEATED</span>
        </div>
      )}
    </div>
  );
}

function CooldownTimer({ remainingMs }) {
  const [ms, setMs] = React.useState(remainingMs);
  useEffect(() => {
    setMs(remainingMs);
    if (remainingMs <= 0) return;
    const interval = setInterval(() => {
      setMs(prev => {
        if (prev <= 1000) { clearInterval(interval); socket.emit('get_state'); return 0; }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingMs]);
  if (ms <= 0) return null;
  return (
    <div className="text-center py-1">
      <div className="text-xs text-yellow-600 font-mono tracking-widest">⏳ COOLDOWN</div>
      <div className="text-xl font-bold font-mono text-yellow-500">{Math.ceil(ms/1000)}s</div>
    </div>
  );
}

function ActionPanel({ state, isOwner }) {
  const phase = state?.phase;
  const me = state?.me;
  const opp = state?.opponent;
  const isMyTurn = state?.isMyTurn;
  const pendingDefense = state?.pendingDefense;
  const cooldownMs = state?.cooldownRemaining || 0;
  const onCooldown = cooldownMs > 0;

  const btn = (label, onClick, style, disabled=false) => (
    <button onClick={disabled ? undefined : onClick}
      className={`w-full py-2.5 px-4 rounded font-mono text-sm tracking-wider transition-all
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-0.5 cursor-pointer'}`}
      style={style}>{label}</button>
  );

  const red  = { background:'linear-gradient(135deg,#7f1d1d,#c0392b)', color:'white', border:'1px solid #c0392b' };
  const blue = { background:'linear-gradient(135deg,#1e1b4b,#7c3aed)', color:'white', border:'1px solid #7c3aed' };
  const gold = { border:'1px solid #c9a227', color:'#f4c842', background:'rgba(201,162,39,0.1)' };
  const cyan = { border:'1px solid #38bdf8', color:'#38bdf8', background:'rgba(56,189,248,0.08)' };
  const pink = { border:'1px solid #e879f9', color:'#e879f9', background:'rgba(232,121,249,0.08)' };
  const gray = { border:'1px solid #374151', color:'#6b7280', background:'transparent' };

  if (phase === 'initiative') return (
    <div className="space-y-2">
      <div className="text-center text-xs text-[#9a9680] tracking-widest font-mono">ROLL INITIATIVE</div>
      {btn('🎲 Roll Initiative', () => socket.emit('roll_initiative'), gold)}
    </div>
  );

  if (phase === 'mb') return (
    <div className="space-y-2">
      <div className="text-center text-xs text-red-400 tracking-widest font-mono">💀 ROUND OVER</div>
      {isOwner && btn('🏁 Finish Round', () => socket.emit('finish_round'), red)}
      {state?.pRollAvailable && btn('✨ P Attempt (need 3)', () => socket.emit('use_ability', { abilityId:'P' }), pink)}
      {!isOwner && <div className="text-center text-xs text-[#5a5650] font-mono py-1">Waiting for room owner...</div>}
    </div>
  );

  if (phase === 'ended') return (
    <div className="space-y-2">
      {state?.pRollAvailable && btn('✨ P Attempt (need 3)', () => socket.emit('use_ability', { abilityId:'P' }), pink)}
      <div className="text-center text-yellow-400 font-mono tracking-widest text-sm py-1">🏆 CHALLENGE COMPLETE</div>
    </div>
  );

  if (phase !== 'battle') return null;

  if (!isMyTurn && !pendingDefense) return (
    <div className="text-center text-[#5a5650] font-mono text-xs tracking-widest py-3">Waiting for opponent...</div>
  );

  if (pendingDefense && !isMyTurn) return (
    <div className="space-y-2">
      <div className="text-center text-xs text-sky-400 tracking-widest font-mono animate-pulse">DEFEND!</div>
      {btn('🛡️ Roll Defense', () => socket.emit('defend'), blue)}
    </div>
  );

  if (isMyTurn && pendingDefense) return (
    <div className="text-center text-[#5a5650] font-mono text-xs tracking-widest py-3">Waiting for opponent to defend...</div>
  );

  if (isMyTurn && !pendingDefense) {
    const hypnoUses = me?.abilityUses?.['HYPNO'] || 0;
    const bcUses    = me?.abilityUses?.['BC']    || 0;
    const weakUses  = me?.abilityUses?.['WEAKNESS'] || 0;
    const defProtOff = !opp?.protection;
    return (
      <div className="space-y-2">
        {onCooldown
          ? <CooldownTimer remainingMs={cooldownMs} />
          : <div className="text-center text-xs text-yellow-400 tracking-widest font-mono">⚔️ YOUR ATTACK TURN</div>}
        {btn('⚔️ Attack', () => socket.emit('attack', {}), onCooldown ? gray : red, onCooldown)}
        {me?.role==='attacker' && hypnoUses===0 && btn('🌀 HYPNO (roll 6)', () => socket.emit('attack',{abilityId:'HYPNO'}), onCooldown?gray:cyan, onCooldown)}
        {me?.role==='attacker' && hypnoUses>0  && btn('🌀 HYPNO — Used', null, gray, true)}
        {me?.role==='attacker' && bcUses===0 && !defProtOff && btn('⛓️ BC Curse (roll 1)', () => socket.emit('attack',{abilityId:'BC'}), onCooldown?gray:cyan, onCooldown)}
        {me?.role==='attacker' && bcUses===0 && defProtOff  && btn('⛓️ BC — Shield OFF', null, gray, true)}
        {me?.role==='attacker' && bcUses>0   && btn('⛓️ BC Curse — Used', null, gray, true)}
        {isOwner && me?.role==='defender' && weakUses===0 && btn('🎯 Weakness Found', () => socket.emit('use_ability',{abilityId:'WEAKNESS'}), gold)}
        {isOwner && me?.role==='defender' && weakUses>0  && btn('🎯 Weakness — Used', null, gray, true)}
      </div>
    );
  }
  return null;
}

export default function BattleScreen() {
  const { gameState, isOwner, roomCode } = useGameStore();
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [gameState?.battleLog?.length]);

  if (!gameState) return null;

  const { me, opponent, battleLog, currentRound, bestOf, roundScores,
          phase, hypnoSkipsRemaining, oppHypnoSkipsRemaining } = gameState;
  const scores = roundScores || {};
  const isMyTurn = gameState.isMyTurn;

  const turnLabel = () => {
    if (phase==='initiative') return { text:'INITIATIVE', color:'#9a9680' };
    if (phase==='mb')         return { text:'💀 ROUND OVER', color:'#ef4444' };
    if (phase==='ended')      return { text:'🏆 COMPLETE', color:'#f4c842' };
    if (gameState.pendingDefense && !isMyTurn) return { text:'⚡ DEFEND NOW', color:'#38bdf8' };
    if (isMyTurn && !gameState.pendingDefense) return { text:'⚔️ YOUR TURN', color:'#f4c842' };
    return { text:"OPPONENT'S TURN", color:'#5a5650' };
  };
  const { text: turnText, color: turnColor } = turnLabel();

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background:'#0a0a0f' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0"
           style={{ background:'#0f0f18', borderBottom:'1px solid #2a2a3a', minHeight:'44px' }}>
        <div className="font-mono text-xs text-[#5a5650] tracking-widest">
          {bestOf > 1
            ? `Best of ${bestOf} · Rd ${currentRound} · ${me?.name||''} ${scores[me?.name]||0}–${scores[opponent?.name]||0} ${opponent?.name||''}`
            : roomCode}
        </div>
        <MatchTimer startedAt={gameState?.startedAt} />
        <div className="font-mono text-xs tracking-widest font-bold" style={{ color:turnColor }}>
          {turnText}
        </div>
      </div>

      {/* Main area: player panels + center */}
      <div className="flex flex-1 overflow-hidden">

        {/* Opponent — left */}
        <div className="shrink-0 p-3 flex flex-col" style={{ width:'200px', borderRight:'1px solid #2a2a3a' }}>
          <PlayerPanel player={opponent} hypnoSkips={oppHypnoSkipsRemaining||0} />
        </div>

        {/* Center: action top, log bottom */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Action area — fixed at top */}
          <div className="shrink-0 p-4" style={{ borderBottom:'1px solid #2a2a3a' }}>
            <ActionPanel state={gameState} isOwner={isOwner} />
          </div>

          {/* Spacer pushes log to bottom */}
          <div className="flex-1" />

          {/* Battle log — pinned to bottom, fixed height */}
          <div style={{ borderTop:'1px solid #2a2a3a', height:'220px' }} className="flex flex-col">
            <div className="px-3 pt-2 pb-1 shrink-0 flex items-center gap-2">
              <span className="text-xs tracking-widest text-[#5a5650] font-mono">📜 BATTLE CHRONICLE</span>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto">
              <BattleLog entries={battleLog||[]} />
            </div>
          </div>
        </div>

        {/* Me — right */}
        <div className="shrink-0 p-3 flex flex-col" style={{ width:'200px', borderLeft:'1px solid #2a2a3a' }}>
          <PlayerPanel player={me} hypnoSkips={hypnoSkipsRemaining||0} />
        </div>
      </div>

      {/* Host controls */}
      {isOwner && (phase==='battle'||phase==='mb') && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap"
             style={{ background:'#0f0f18', borderTop:'1px solid #2a2a3a' }}>
          <span className="text-xs text-[#5a5650] font-mono tracking-widest">HOST:</span>
          {[['word_teasing','Word Teasing → A'],['roomplay_corruption','Corruption → H']].map(([id,label]) => (
            <button key={id} onClick={() => socket.emit('manual_action',{actionId:id, targetName:opponent?.name})}
              className="text-xs px-3 py-1 rounded font-mono border border-[#2a2a3a] text-[#9a9680] hover:border-yellow-700 hover:text-yellow-500 transition-all">
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
