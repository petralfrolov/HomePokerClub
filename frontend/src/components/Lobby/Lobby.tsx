import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { TableSummary } from '../../types';
import { CreateTableModal } from '../Modals/CreateTableModal';
import { JoinTableModal } from '../Modals/JoinTableModal';
import './Lobby.css';

export function Lobby() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [joinTableId, setJoinTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const nickname = useStore((s) => s.nickname);
  const setNickname = useStore((s) => s.setNickname);
  const sessionId = useStore((s) => s.sessionId);
  const [nickInput, setNickInput] = useState(nickname);
  const navigate = useNavigate();

  useEffect(() => {
    loadTables();
    const interval = setInterval(loadTables, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadTables() {
    try {
      const data = await api.listTables();
      setTables(data);
    } catch (e) {
      console.error('Failed to load tables', e);
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
      <div className="lobby-header">
        <h2>Лобби</h2>
        {!nickname ? (
          <div className="nick-form">
            <input
              type="text"
              placeholder="Ваш никнейм"
              maxLength={20}
              value={nickInput}
              onChange={(e) => setNickInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetNickname()}
            />
            <button onClick={handleSetNickname}>Войти</button>
          </div>
        ) : (
          <div className="nick-display">
            <span>👤 {nickname}</span>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + Создать стол
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="lobby-loading">Загрузка...</div>
      ) : tables.length === 0 ? (
        <div className="lobby-empty">
          Нет доступных столов. Создайте первый!
        </div>
      ) : (
        <div className="tables-grid">
          {tables.map((t) => (
            <div key={t.id} className="table-card" onClick={() => nickname && setJoinTableId(t.id)}>
              <div className="table-card-header">
                <span className="table-name">{t.name}</span>
                <span className={`table-type ${t.type}`}>
                  {t.type === 'cash' ? 'Кэш' : 'Турнир'}
                </span>
              </div>
              <div className="table-card-info">
                <span>Блайнды: {t.blind_small}/{t.blind_small * 2}</span>
                <span>Игроки: {t.players_count}/{t.max_players}</span>
              </div>
              <div className={`table-status ${t.status}`}>
                {t.status === 'waiting' ? 'Ожидание' : t.status === 'running' ? 'Идёт игра' : 'Завершён'}
              </div>
              {t.players_count === 0 && (
                <button
                  className="btn-delete-table"
                  onClick={(e) => {
                    e.stopPropagation();
                    api.deleteTable(t.id).then(() => loadTables()).catch((err) => alert(err.message));
                  }}
                >
                  🗑 Удалить
                </button>
              )}
            </div>
          ))}
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
