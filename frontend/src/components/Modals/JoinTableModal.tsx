import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { S } from '../../strings';
import './Modals.css';

interface Props {
  tableId: string;
  isReturning?: boolean;
  returningStack?: number | null;
  onClose: () => void;
  onJoined: (tableId: string) => void;
}

export function JoinTableModal({ tableId, isReturning, returningStack, onClose, onJoined }: Props) {
  const sessionId = useStore((s) => s.sessionId);
  const nickname = useStore((s) => s.nickname);
  const setMyPlayerId = useStore((s) => s.setMyPlayerId);
  const clearAfkTable = useStore((s) => s.clearAfkTable);
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

  async function handleReturn() {
    setLoading(true);
    setError('');
    try {
      await api.setAway(tableId, { session_id: sessionId, away: false });
    } catch (e) {
      // Player might not be AFK, ignore
    }
    clearAfkTable();
    onJoined(tableId);
  }

  if (!tableInfo) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={S.joinTableTitle}
      >
        <h3>{isReturning ? S.returnToTable : S.joinTableTitle}</h3>
        <p className="modal-subtitle">{tableInfo.name}</p>

        <div className="table-info-summary">
          <div>{S.typeLabel}: {tableInfo.type === 'cash' ? S.cash : S.tournament}</div>
          <div>{S.blindsLabel}: {tableInfo.blind_small}/{tableInfo.blind_big}</div>
          <div>{S.playersLabel}: {tableInfo.players?.length || 0}/9</div>
        </div>

        {isReturning ? (
          <div className="form-group">
            <label>{S.yourChips}</label>
            <div className="returning-stack-display">{returningStack ?? 0}</div>
          </div>
        ) : tableInfo.type === 'cash' ? (
          <div className="form-group">
            <label>
              {S.buyinLabel} ({tableInfo.min_buyin} – {tableInfo.max_buyin})
            </label>
            <input
              type="number"
              min={tableInfo.min_buyin}
              max={tableInfo.max_buyin}
              value={buyin}
              onChange={(e) => setBuyin(parseInt(e.target.value) || 0)}
            />
          </div>
        ) : null}

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>{S.cancel}</button>
          <button className="btn-primary" onClick={isReturning ? handleReturn : handleJoin} disabled={loading}>
            {loading ? S.joining : isReturning ? S.returnToTable : S.joinTable}
          </button>
        </div>
      </div>
    </div>
  );
}
