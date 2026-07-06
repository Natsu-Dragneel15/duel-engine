import { create } from 'zustand';

const useGameStore = create((set) => ({
  // Connection
  roomCode:  null,
  myRole:    null,
  isOwner:   false,
  connected: false,

  // Game state from server
  gameState: null,

  // UI
  toast: null,

  // Actions
  setRoomInfo: (code, role, isOwner) => set({ roomCode: code, myRole: role, isOwner }),
  setGameState: (state) => set({ gameState: state }),
  setConnected: (v) => set({ connected: v }),

  showToast: (message, type = '') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },

  reset: () => set({
    roomCode: null, myRole: null, isOwner: false,
    gameState: null, toast: null
  })
}));

export default useGameStore;
