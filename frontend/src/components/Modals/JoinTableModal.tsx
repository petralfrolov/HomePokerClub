import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import './Modals.css';

interface Props {
  tableId: string;
  onClose: () => void;
  onJoined: (tableId: string) => void;
}

export function JoinTableModal({ tableId, onClose, onJoined }: Props) {
  const sessionId = useStore((s) => s.sessionId);
  const nickname = useStore((s) => s.nickname);
  const setMyPlayerId = useStore((s) => s.setMyPlayerId);
  const [tableInfo, setTableInfo] = useState<any>(null);
  const [buyin, setBuyin] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getTable(tableId).then((data) => {
      setTableInfo(data);
      if (data.type === 'cash') {
        setBuyin(data.min_buyin || data.blind_big * 20);
      } else {
        setBuyin(data.starting_stack || 1500);
      }
    });
  }, [tableId]);

  async function handleJoin() {
    setLoading(true);
    setError('');
    try {
      const res = await api.joinTable(tableId, {
        session_id: sessionId,
        nickname,
        buyin,
      });
      setMyPlayerId(res.player_id);
      onJoined(tableId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!tableInfo) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Присоединиться к столу</h3>
        <p className="modal-subtitle">{tableInfo.name}</p>

        <div className="table-info-summary">
          <div>Тип: {tableInfo.type === 'cash' ? 'Кэш' : 'Турнир'}</div>
          <div>Блайнды: {tableInfo.blind_small}/{tableInfo.blind_big}</div>
          <div>Игроки: {tableInfo.players?.length || 0}/9</div>
        </div>

        {tableInfo.type === 'cash' && (
          <div className="form-group">
            <label>
              Байин ({tableInfo.min_buyin} – {tableInfo.max_buyin})
            </label>
            <input
              type="number"
              min={tableInfo.min_buyin}
              max={tableInfo.max_buyin}
              value={buyin}
              onChange={(e) => setBuyin(parseInt(e.target.value) || 0)}
            />
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleJoin} disabled={loading}>
            {loading ? 'Вход...' : 'Войти за стол'}
          </button>
        </div>
      </div>
    </div>
  );
}
