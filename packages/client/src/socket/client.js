import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const socket = io(URL, {
  autoConnect: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});

export default socket;
