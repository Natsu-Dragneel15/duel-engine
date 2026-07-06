const STATUS_COLORS = {
  N:  'border-gray-600 text-gray-400',
  R:  'border-orange-400 text-orange-400',
  A:  'border-pink-400 text-pink-400',
  H:  'border-fuchsia-400 text-fuchsia-400',
  AD: 'border-red-500 text-red-400',
  MB: 'bg-red-600 border-red-600 text-black font-bold',
};

export default function StatusBadge({ status }) {
  if (!status) return null;
  const cls = STATUS_COLORS[status] || 'border-gray-600 text-gray-400';
  return (
    <span className={`inline-block px-3 py-0.5 rounded-full border text-xs font-mono tracking-widest ${cls}`}>
      {status}
    </span>
  );
}
