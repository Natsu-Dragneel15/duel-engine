export default function HPBar({ hp, maxHp }) {
  const pct = maxHp > 0 ? (hp / maxHp) * 100 : 0;
  const color = pct > 50 ? '#22c55e' : pct > 25 ? '#eab308' : '#ef4444';

  return (
    <div className="w-full h-3 rounded-full overflow-hidden bg-[#13131f] border border-[#2a2a3a]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
