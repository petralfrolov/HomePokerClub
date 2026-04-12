import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { PlayerInfo } from '../../types';
import './Player.css';

interface Props {
  player: PlayerInfo;
  onClose: () => void;
}

export function PlayerContextMenu({ player, onClose }: Props) {
  const sessionId = useStore((s) => s.sessionId);
  const tableId = useStore((s) => s.tableId);
  const gameState = useStore((s) => s.gameState);
  const tableConfig = useStore((s) => s.tableConfig);
  const [tipAmount, setTipAmount] = useState('');
  const [showTipInput, setShowTipInput] = useState(false);

  const isTargetTurn = gameState?.current_player_seat === player.seat_index;
  const isAdmin = tableConfig?.admin_session_id === sessionId;

  async function handleTip() {
    if (!tableId || !tipAmount) return;
    const amount = parseInt(tipAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      await api.tipPlayer(tableId, {
        session_id: sessionId,
        target_player_id: player.player_id,
        amount,
      });
      onClose();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleAccuseStalling() {
    if (!tableId) return;
    try {
      await api.accuseStalling(tableId, {
        session_id: sessionId,
        target_player_id: player.player_id,
      });
      onClose();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleKick() {
    if (!tableId) return;
    if (!confirm(`Кикнуть ${player.nickname}? Будет выполнен принудительный кэшаут.`)) return;
    try {
      await api.kickPlayer(tableId, {
        session_id: sessionId,
        target_player_id: player.player_id,
      });
      onClose();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="context-menu" onClick={(e) => e.stopPropagation()}>
      <div className="context-menu-header">
        <span className="context-menu-nickname">{player.nickname}</span>
        <span className="context-menu-stack">Стек: {player.stack}</span>
      </div>
      <div className="context-menu-items">
        {showTipInput ? (
          <div className="context-menu-tip-input">
            <input
              type="number"
              min={1}
              placeholder="Сумма"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              autoFocus
            />
            <button onClick={handleTip}>Отправить</button>
          </div>
        ) : (
          <button className="context-menu-item" onClick={() => setShowTipInput(true)}>
            💰 Типнуть
          </button>
        )}
        {isTargetTurn && (
          <button className="context-menu-item" onClick={handleAccuseStalling}>
            ⏱ Упрекнуть в столлинге
          </button>
        )}
        {isAdmin && (
          <button className="context-menu-item context-menu-item-danger" onClick={handleKick}>
            ❌ Кикнуть
          </button>
        )}
      </div>
    </div>
  );
}
