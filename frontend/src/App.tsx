import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import { api } from './api';
import { Lobby } from './components/Lobby/Lobby';
import { TableView } from './components/Table/TableView';
import { SoundControls } from './components/Controls/SoundControls';
import { S } from './strings';
import './components/Table/Table.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
          <h2>Что-то пошло не так</h2>
          <p style={{ color: '#aaa' }}>{this.state.error?.message}</p>
          <button
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', cursor: 'pointer' }}
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
          >
            Вернуться в лобби
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
