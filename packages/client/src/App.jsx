import { useState, useEffect } from 'react';
import useSocket from './hooks/useSocket';
import useGameStore from './store/gameStore';
import Toast from './components/Toast';
import LandingScreen from './screens/LandingScreen';
import CreateScreen  from './screens/CreateScreen';
import JoinScreen    from './screens/JoinScreen';
import LobbyScreen   from './screens/LobbyScreen';
import BattleScreen  from './screens/BattleScreen';

export default function App() {
  const [screen, setScreen] = useState('landing');
  const socket    = useSocket();
  const gameState = useGameStore(s => s.gameState);
  const roomCode  = useGameStore(s => s.roomCode);

  // Auto-navigate based on server state
  useEffect(() => {
    if (!roomCode) { setScreen('landing'); return; }
    if (!gameState) { setScreen('lobby'); return; }
    const phase = gameState.phase;
    if (phase === 'lobby')                          setScreen('lobby');
    else if (['initiative','battle','mb','ended']
              .includes(phase))                     setScreen('battle');
  }, [roomCode, gameState?.phase]);

  return (
    <>
      {screen === 'landing' && (
        <LandingScreen
          onCreate={() => setScreen('create')}
          onJoin={()   => setScreen('join')} />
      )}
      {screen === 'create'  && <CreateScreen  onBack={() => setScreen('landing')} />}
      {screen === 'join'    && <JoinScreen    onBack={() => setScreen('landing')} />}
      {screen === 'lobby'   && <LobbyScreen />}
      {screen === 'battle'  && <BattleScreen />}
      <Toast />
    </>
  );
}
