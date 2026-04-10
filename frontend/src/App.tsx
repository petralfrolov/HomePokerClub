import { Routes, Route } from 'react-router-dom';
import { Lobby } from './components/Lobby/Lobby';
import { TableView } from './components/Table/TableView';
import { SoundControls } from './components/Controls/SoundControls';

export default function App() {
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
    </div>
  );
}
