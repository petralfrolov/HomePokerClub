import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import './Modals.css';

export function RebuyModal() {
  const pendingRebuy = useStore((s) => s.pendingRebuy);
  const setPendingRebuy = useStore((s) => s.setPendingRebuy);
  const sessionId = useStore((s) => s.sessionId);
  const tableId = useStore((s) => s.tableId);
  const tableConfig = useStore((s) => s.tableConfig);
  const gameState = useStore((s) => s.gameState);

  // Only show to table admin
  const isAdmin = tableConfig?.admin_session_id === sessionId;
  if (!pendingRebuy || !tableId || !isAdmin) return null;

  const playerName = gameState?.players.find(
    (p) => p.player_id === pendingRebuy.player_id
  )?.nickname || 'Игрок';

  async function handleApprove() {
    try {
      await api.approveRebuy(tableId!, {
        session_id: sessionId,
        target_player_id: pendingRebuy!.player_id,
        amount: pendingRebuy!.amount,
      });
    } catch (e) {
      console.error(e);
    }
    setPendingRebuy(null);
  }

  async function handleDeny() {
    try {
      await api.denyRebuy(tableId!, {
        session_id: sessionId,
        target_player_id: pendingRebuy!.player_id,
      });
    } catch (e) {
      console.error(e);
    }
    setPendingRebuy(null);
  }

  return (
    <div className="modal-overlay" onClick={() => setPendingRebuy(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Запрос на додепоз</h3>
        <p>
          {playerName} хочет додепозиться на сумму <strong>{pendingRebuy.amount}</strong>.
        </p>
        <p>Разрешить?</p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={handleDeny}>Нет</button>
          <button className="btn-primary" onClick={handleApprove}>Да</button>
        </div>
      </div>
    </div>
  );
}
