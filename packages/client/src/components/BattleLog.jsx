const TYPE_COLORS = {
  hit:          "text-red-400",
  miss:         "text-sky-400",
  game_over:    "text-yellow-400 font-semibold",
  round_over:   "text-yellow-300",
  mb_triggered: "text-red-300",
  weakness:     "text-orange-400",
  p_roll:       "text-fuchsia-400",
  p_activated:  "text-fuchsia-400",
};

import { useEffect, useRef } from "react";

export default function BattleLog({ entries = [] }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {entries.map(e => (
        <div key={e.id} className="text-xs leading-snug flex gap-1.5">
          <span className="shrink-0 text-[#3a3a4a] font-mono">
            {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className={TYPE_COLORS[e.type] || "text-[#7a7660]"}>
            {e.message}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
