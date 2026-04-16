import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, toast } from '../../store/useStore';
import { api } from '../../api';
import { TableSummary } from '../../types';
import { CreateTableModal } from '../Modals/CreateTableModal';
import { JoinTableModal } from '../Modals/JoinTableModal';
import { S } from '../../strings';
import './Lobby.css';

export function Lobby() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [joinTableId, setJoinTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const nickname = useStore((s) => s.nickname);
  const setNickname = useStore((s) => s.setNickname);
  const sessionId = useStore((s) => s.sessionId);
  const kickedCashout = useStore((s) => s.kickedCashout);
  const clearKicked = useStore((s) => s.clearKicked);
  const afkTableId = useStore((s) => s.afkTableId);
  const afkTableStack = useStore((s) => s.afkTableStack);
  const [nickInput, setNickInput] = useState(nickname);
  const [editingNick, setEditingNick] = useState(false);
  const [kickMessage, setKickMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  // Show kick notification
  useEffect(() => {
    if (kickedCashout !== null) {
      setKickMessage(S.kickedMessage(kickedCashout));
      clearKicked();
      const timer = setTimeout(() => setKickMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [kickedCashout, clearKicked]);

  useEffect(() => {
    loadTables();
    const interval = setInterval(loadTables, 5000);
    return () => clearInterval(interval);
  }, []);

  const hadFirstLoadRef = useRef(false);

  async function loadTables() {
    try {
      const data = await api.listTables();
      setTables(data);
      hadFirstLoadRef.current = true;
    } catch (e: any) {
      console.error('Failed to load tables', e);
      // Only toast on first-load failure; suppress noise during background polling.
      if (!hadFirstLoadRef.current) {
        toast(e?.message || 'Не удалось загрузить список столов', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSetNickname() {
    if (nickInput.trim().length > 0 && nickInput.trim().length <= 20) {
      setNickname(nickInput.trim());
    }
  }

  return (
    <div className="lobby">
      {kickMessage && (
        <div className="kick-banner">
          {kickMessage}
          <button className="kick-banner-close" onClick={() => setKickMessage(null)}>✕</button>
        </div>
      )}
      <div className="lobby-header">
        <h2>{S.lobbyTitle}</h2>
        {!nickname ? (
          <div className="nick-form">
            <input
              type="text"
              placeholder={S.nicknamePlaceholder}
              maxLength={20}
              value={nickInput}
              onChange={(e) => setNickInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetNickname()}
            />
            <button onClick={handleSetNickname}>{S.enter}</button>
          </div>
        ) : (
          <div className="nick-display">
            {editingNick ? (
              <div className="nick-form">
                <input
                  type="text"
                  placeholder={S.newNickPlaceholder}
                  maxLength={20}
                  value={nickInput}
                  onChange={(e) => setNickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (nickInput.trim().length > 0 && nickInput.trim().length <= 20) {
                        setNickname(nickInput.trim());
                      }
                      setEditingNick(false);
                    } else if (e.key === 'Escape') {
                      setNickInput(nickname);
                      setEditingNick(false);
                    }
                  }}
                  onBlur={() => {
                    if (nickInput.trim().length > 0 && nickInput.trim().length <= 20) {
                      setNickname(nickInput.trim());
                    }
                    setEditingNick(false);
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <span
                className="nick-display-name"
                onClick={() => { setNickInput(nickname); setEditingNick(true); }}
                title={S.changeNickTooltip}
              >
                👤 {nickname} ✏️
              </span>
            )}
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              {S.createTableBtn}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="lobby-loading">{S.loading}</div>
      ) : tables.length === 0 ? (
        <div className="lobby-empty">
          {S.noTables}
        </div>
      ) : (
        <div className="tables-grid">
          {tables.map((t) => {
            const isMyTable = afkTableId === t.id;
            return (
              <div key={t.id} className={`table-card ${isMyTable ? 'table-card-mine' : ''}`} onClick={() => nickname && setJoinTableId(t.id)}>
                <div className="table-card-header">
                  <span className="table-name">{t.name}</span>
                  <span className={`table-type ${t.type}`}>
                    {t.type === 'cash' ? S.cash : S.tournament}
                  </span>
                </div>
                <div className="table-card-info">
                  <span>{S.blindsLabel}: {t.blind_small}/{t.blind_small * 2}</span>
                  <span>{S.playersLabel}: {t.players_count}/{t.max_players}</span>
                </div>
                <div className={`table-status ${t.status}`}>
                  {t.status === 'waiting' ? S.statusWaiting : t.status === 'running' ? S.statusRunning : S.statusFinished}
                </div>
                {isMyTable && (
                  <div className="table-card-afk-badge">
                    <span>{S.atTableBadge}</span>
                    <span className="afk-badge-stack">{S.chipsLabel}: {afkTableStack}</span>
                  </div>
                )}
                {t.players_count === 0 && (
                  <button
                    className="btn-delete-table"
                    onClick={(e) => {
                      e.stopPropagation();
                      api.deleteTable(t.id).then(() => loadTables()).catch((err) => alert(err.message));
                    }}
                  >
                    {S.deleteTable}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTableModal
          onClose={() => setShowCreate(false)}
          onCreated={(tableId) => {
            setShowCreate(false);
            setJoinTableId(tableId);
          }}
        />
      )}

      {joinTableId && (
        <JoinTableModal
          tableId={joinTableId}
          isReturning={afkTableId === joinTableId}
          returningStack={afkTableStack}
          onClose={() => setJoinTableId(null)}
          onJoined={(tableId) => {
            setJoinTableId(null);
            navigate(`/table/${tableId}`);
          }}
        />
      )}
    </div>
  );
}
