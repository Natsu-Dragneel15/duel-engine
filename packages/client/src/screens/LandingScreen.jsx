export default function LandingScreen({ onCreate, onJoin }) {
  return (
    <div className="screen flex flex-col items-center justify-center p-6 text-center"
         style={{ background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0a0a0f 60%)' }}>
      <div className="text-6xl mb-4" style={{ filter: 'drop-shadow(0 0 20px #c9a227)' }}>⚔️</div>
      <h1 className="text-5xl font-bold tracking-[8px] mb-2"
          style={{ color: '#f4c842', textShadow: '0 0 30px #c9a22766' }}>
        DUEL ENGINE
      </h1>
      <p className="text-sm tracking-[4px] mb-12" style={{ color: '#9a9680' }}>
        ONLINE DUEL PLATFORM
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <button onClick={onCreate}
          className="px-8 py-3 rounded font-mono tracking-wider text-white transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg,#8b1a1a,#c0392b)', boxShadow: '0 0 20px #c0392b66' }}>
          🏰 CREATE MATCH
        </button>
        <button onClick={onJoin}
          className="px-8 py-3 rounded font-mono tracking-wider transition-all hover:-translate-y-0.5"
          style={{ border: '1px solid #c9a227', color: '#f4c842', background: 'rgba(201,162,39,0.1)' }}>
          ⚔️ JOIN MATCH
        </button>
      </div>
    </div>
  );
}
