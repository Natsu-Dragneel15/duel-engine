import { useEffect } from 'react';
import socket from '../socket/client';
import useGameStore from '../store/gameStore';

export default function useSocket() {
  const { setRoomInfo, setGameState, setConnected, showToast } = useGameStore();

  useEffect(() => {
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => {
      setConnected(false);
      showToast('Connection lost. Reconnecting...', 'error');
    });

    socket.on('room_created', ({ code, role }) => {
      setRoomInfo(code, role, true);
    });

    socket.on('room_joined', ({ code, role }) => {
      setRoomInfo(code, role, false);
    });

    socket.on('state_update', (state) => {
      setGameState(state);
    });

    socket.on('player_joined', ({ name }) => {
      showToast(`${name} joined the arena!`, 'success');
    });

    socket.on('player_disconnected', ({ name }) => {
      showToast(`${name} disconnected. Room stays open 30 min.`, 'error');
    });

    socket.on('all_ready', () => {
      showToast('Both players ready!', 'success');
    });

    socket.on('error', ({ message }) => {
      showToast(message, 'error');
    });

    socket.on('export_data', (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `duel-log-${Date.now()}.json`;
      a.click();
    });

    return () => socket.removeAllListeners();
  }, []);

  return socket;
}
