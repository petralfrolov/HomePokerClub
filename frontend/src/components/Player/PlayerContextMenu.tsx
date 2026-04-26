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
  // Can tip up to (own stack - 1 BB), snapped to SB step. Must keep ≥ 1 BB.
  const rawMaxTip = Math.max(0, (myPlayer?.stack || 0) - bb);
  const maxTip = Math.floor(rawMaxTip / sb) * sb;
  const canTip = maxTip >= sb;

  const [tipAmount, setTipAmount] = useState(sb);
  const [showTipInput, setShowTipInput] = useState(false);

  // Shtos: amount in [0.5 BB, min(stacks) - 1 BB], snapped to SB step.
  const shtosBlocks = useStore((s) => s.shtosBlocks);
  const isBlocked = shtosBlocks.includes(player.player_id);
  const shtosMin = Math.max(1, Math.floor(bb / 2));
  const rawShtosMax = Math.max(0, Math.min(myPlayer?.stack || 0, player.stack) - bb);
  const shtosMax = Math.floor(rawShtosMax / sb) * sb;
  const canShtos = shtosMax >= shtosMin && !player.away && !player.pending_approval && player.status !== 'bust';
  const [shtosAmount, setShtosAmount] = useState(Math.max(shtosMin, sb));
  const [showShtosInput, setShowShtosInput] = useState(false);

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

  async function handleProposeShtos() {
    if (!tableId) return;
    const amount = Math.min(Math.max(shtosAmount, shtosMin), shtosMax);
    try {
      await api.proposeShtos(tableId, {
        session_id: sessionId,
        target_player_id: player.player_id,
        amount,
      });
      onClose();
    } catch (e: any) {
      toast(e?.message || 'Не удалось предложить штос', 'error');
    }
  }

  async function handleToggleShtosBlock() {
    if (!tableId) return;
    const next = !isBlocked;
    try {
      await api.setShtosBlock(tableId, {
        session_id: sessionId,
        target_player_id: player.player_id,
        blocked: next,
      });
      toast(next ? S.shtosBlockedToast(player.nickname) : S.shtosUnblockedToast(player.nickname), 'info', 2500);
      onClose();
    } catch (e: any) {
      toast(e?.message || 'Не удалось обновить блокировку', 'error');
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
              value={Math.min(tipAmount, maxTip)}
              onChange={(e) => setTipAmount(parseInt(e.target.value))}
            />
            <span className="tip-amount-display">{tipAmount}</span>
            <button onClick={handleTip} disabled={!canTip || tipAmount > maxTip}>{S.send}</button>
          </div>
        ) : (
          <button
            className="context-menu-item"
            onClick={() => setShowTipInput(true)}
            disabled={!canTip}
            title={!canTip ? S.tipDisabledTooSmall : undefined}
          >
            {S.tipBtn}
          </button>
        )}
        {isTargetTurn && (
          <button className="context-menu-item" onClick={handleAccuseStalling}>
            {S.accuseStalling}
          </button>
        )}
        {showShtosInput ? (
          <div className="context-menu-tip-input">
            <input
              type="range"
              min={shtosMin}
              max={Math.max(shtosMin, shtosMax)}
              step={sb}
              value={Math.min(Math.max(shtosAmount, shtosMin), shtosMax)}
              onChange={(e) => setShtosAmount(parseInt(e.target.value))}
            />
            <span className="tip-amount-display">{shtosAmount}</span>
            <button onClick={handleProposeShtos} disabled={!canShtos}>{S.shtosPropose}</button>
          </div>
        ) : (
          <button
            className="context-menu-item"
            onClick={() => setShowShtosInput(true)}
            disabled={!canShtos}
            title={!canShtos ? S.shtosTooSmallStack : undefined}
          >
            {S.shtosBtn}
          </button>
        )}
        <button className="context-menu-item" onClick={handleToggleShtosBlock}>
          {isBlocked ? S.shtosUnblockBtn : S.shtosBlockBtn}
        </button>
        {isAdmin && (
          <button className="context-menu-item context-menu-item-danger" onClick={handleKick}>
            {S.kickBtn}
          </button>
        )}
      </div>
    </div>
  );
}
