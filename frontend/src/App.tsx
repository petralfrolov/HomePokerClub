import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import { api } from './api';
import { Lobby } from './components/Lobby/Lobby';
import { TableView } from './components/Table/TableView';
import { SoundControls } from './components/Controls/SoundControls';
import { S } from './strings';
import './components/Table/Table.css';

export default function App() {
  const showKickedOverlay = useStore((s) => s.showKickedOverlay);
  const navigate = useNavigate();
  const location = useLocation();
  const sessionId = useStore((s) => s.sessionId);
  const tableId = useStore((s) => s.tableId);
  const gameState = useStore((s) => s.gameState);
  const setAfkTable = useStore((s) => s.setAfkTable);

  async function handleLogoClick() {
    if (location.pathname === '/') return;
    if (!tableId || !gameState) {
      navigate('/');
      return;
    }
    const myPlayer = gameState.players.find((p) => p.session_id === sessionId);
    if (!myPlayer) {
      navigate('/');
      return;
    }
    try {
      // Fold if it's our turn in an active hand
      if (
        gameState.current_player_seat === myPlayer.seat_index &&
        myPlayer.status === 'active' &&
        myPlayer.hole_cards &&
        myPlayer.hole_cards.length > 0
      ) {
        await api.gameAction(tableId, { session_id: sessionId, action: 'fold' });
      }
      // Set AFK
      if (!myPlayer.away) {
        await api.setAway(tableId, { session_id: sessionId, away: true });
      }
    } catch (e) {
      console.error(e);
    }
    setAfkTable(tableId, myPlayer.stack);
    navigate('/');
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>{S.appTitle}</h1>
        <SoundControls />
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/table/:tableId" element={<TableView />} />
        </Routes>
      </main>

      {/* Kicked overlay */}
      {showKickedOverlay && (
        <div className="stalling-overlay kicked-overlay">
          <span className="stalling-text kicked-text">{S.kickedOverlay}</span>
        </div>
      )}
    </div>
  );
}
