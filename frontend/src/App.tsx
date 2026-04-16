import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useStore, toast } from './store/useStore';
import { api } from './api';
import { Lobby } from './components/Lobby/Lobby';
import { TableView } from './components/Table/TableView';
import { SoundControls } from './components/Controls/SoundControls';
import { ToastStack } from './components/Toast/Toast';
import { ConnectionBadge } from './components/Controls/ConnectionBadge';
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

  // Global unhandled-error listeners → user-visible toast instead of silent fail.
  React.useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason: any = e.reason;
      // Ignore aborted fetches (intentional cancellation / route changes)
      if (reason?.name === 'AbortError') return;
      console.error('Unhandled rejection:', reason);
      const msg = reason?.message || reason?.detail || 'Непредвиденная ошибка';
      toast(String(msg), 'error');
    };
    const onError = (e: ErrorEvent) => {
      console.error('Window error:', e.error || e.message);
    };
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

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
      toast('Не удалось покинуть стол', 'error');
    }
    setAfkTable(tableId, myPlayer.stack);
    navigate('/');
  }

  return (
    <ErrorBoundary>
    <div className="app">
      <header className="app-header">
        <h1 className="app-title" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>{S.appTitle}</h1>
        <div className="app-header-right">
          <ConnectionBadge />
          <SoundControls />
        </div>
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
      <ToastStack />
    </div>
    </ErrorBoundary>
  );
}
