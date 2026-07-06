import useGameStore from '../store/gameStore';

export default function Toast() {
  const toast = useGameStore(s => s.toast);
  if (!toast) return null;

  const colors = {
    error:   'border-red-500 text-red-400',
    success: 'border-green-500 text-green-400',
    '':      'border-yellow-600 text-yellow-200'
  };

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded border text-sm font-mono tracking-wide shadow-xl backdrop-blur
      bg-[#0f0f18] ${colors[toast.type] || colors['']}`}>
      {toast.message}
    </div>
  );
}
