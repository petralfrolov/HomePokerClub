import { Routes, Route } from 'react-router-dom';
import { useStore } from './store/useStore';
import { Lobby } from './components/Lobby/Lobby';
import { TableView } from './components/Table/TableView';
import { SoundControls } from './components/Controls/SoundControls';
import './components/Table/Table.css';

export default function App() {
  const showKickedOverlay = useStore((s) => s.showKickedOverlay);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">♠ Home Poker Club</h1>
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
          <span className="stalling-text kicked-text">КИКНУТ</span>
        </div>
      )}
    </div>
  );
}
