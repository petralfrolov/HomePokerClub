import { useState } from 'react';
import { useStore, toast } from '../../store/useStore';
import { api } from '../../api';
import { PlayerInfo } from '../../types';
import { S } from '../../strings';
import { formatChips } from '../../formatChips';
import './Player.css';

interface Props {
  player: PlayerInfo;
  onClose: () => void;
  openLeft?: boolean;
}

export function PlayerContextMenu({ player, onClose, openLeft }: Props) {
  const sessionId = useStore((s) => s.sessionId);
  const tableId = useStore((s) => s.tableId);
  const gameState = useStore((s) => s.gameState);
  const tableConfig = useStore((s) => s.tableConfig);
  const displayInBB = useStore((s) => s.displayInBB);

  const sb = gameState?.blind_small || 1;
  const bb = gameState?.blind_big || 0;
  const myPlayer = gameState?.players.find((p) => p.session_id === sessionId);
  const maxTip = Math.max(sb, Math.floor((myPlayer?.stack || sb) / sb) * sb);

  const [tipAmount, setTipAmount] = useState(sb);
  const [showTipInput, setShowTipInput] = useState(false);

  const isTargetTurn = gameState?.current_player_seat === player.seat_index;
  const isAdmin = tableConfig?.admin_session_id === sessionId;

  async function handleTip() {
    if (!tableId || tipAmount <= 0) return;

    try {
      await api.tipPlayer(tableId, {
        session_id: sessionId,
        target_player_id: player.player_id,
        amount: tipAmount,
      });
      onClose();
    } catch (e: any) {
      toast(e?.message || 'Не удалось отправить чаевые', 'error');
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
      toast(e?.message || 'Не удалось отправить упрёк', 'error');
    }
  }

  async function handleKick() {
    if (!tableId) return;
    if (!confirm(S.kickConfirm(player.nickname))) return;
    try {
      await api.kickPlayer(tableId, {
        session_id: sessionId,
        target_player_id: player.player_id,
      });
      onClose();
    } catch (e: any) {
      toast(e?.message || 'Не удалось кикнуть игрока', 'error');
    }
  }

  return (
    <div className={`context-menu ${openLeft ? 'context-menu-left' : ''}`} onClick={(e) => e.stopPropagation()}>
      <div className="context-menu-header">
        <span className="context-menu-nickname">{player.nickname}</span>
        <span className="context-menu-stack">{S.stackLabel}: {formatChips(player.stack, displayInBB, bb)}</span>
      </div>
      <div className="context-menu-items">
        {showTipInput ? (
          <div className="context-menu-tip-input">
            <input
              type="range"
              min={sb}
              max={maxTip}
              step={sb}
              value={tipAmount}
              onChange={(e) => setTipAmount(parseInt(e.target.value))}
            />
            <span className="tip-amount-display">{tipAmount}</span>
            <button onClick={handleTip}>{S.send}</button>
          </div>
        ) : (
          <button className="context-menu-item" onClick={() => setShowTipInput(true)}>
            {S.tipBtn}
          </button>
        )}
        {isTargetTurn && (
          <button className="context-menu-item" onClick={handleAccuseStalling}>
            {S.accuseStalling}
          </button>
        )}
        {isAdmin && (
          <button className="context-menu-item context-menu-item-danger" onClick={handleKick}>
            {S.kickBtn}
          </button>
        )}
      </div>
    </div>
  );
}
