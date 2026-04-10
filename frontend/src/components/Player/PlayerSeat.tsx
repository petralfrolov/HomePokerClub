import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { PlayerInfo } from '../../types';
import { CardDisplay } from '../Table/CardDisplay';
import { PlayerContextMenu } from './PlayerContextMenu';
import './Player.css';

interface Props {
  player: PlayerInfo;
  totalPlayers: number;
  index: number;
}

// Calculate position on ellipse, avoiding top zone (dealer area)
function getSeatPosition(index: number, total: number): { left: string; top: string } {
  // Leave ~80° gap at the top for the dealer
  const GAP = Math.PI * 0.44;
  const arc = 2 * Math.PI - GAP;
  const start = -Math.PI / 2 + GAP / 2;
  const step = arc / Math.max(total, 1);
  const angle = start + step * (index + 0.5);

  const rx = 48;
  const ry = 42;
  const cx = 50;
  const cy = 53;
  const x = cx + rx * Math.cos(angle);
  const y = cy + ry * Math.sin(angle);
  return { left: `${x}%`, top: `${y}%` };
}

export function PlayerSeat({ player, totalPlayers, index }: Props) {
  const sessionId = useStore((s) => s.sessionId);
  const gameState = useStore((s) => s.gameState);
  const tableId = useStore((s) => s.tableId);
  const turnTimer = useStore((s) => s.turnTimer);
  const [showMenu, setShowMenu] = useState(false);
  const [timerPercent, setTimerPercent] = useState(100);
  const menuTimeout = useRef<ReturnType<typeof setTimeout>>();

  const isMe = player.session_id === sessionId;
  const isCurrentTurn = gameState?.current_player_seat === player.seat_index;
  const isDealer = gameState?.dealer_seat === player.seat_index;
  const position = getSeatPosition(index, totalPlayers);

  // Is this player the one with the active timer?
  const isTimerPlayer = turnTimer && turnTimer.playerId === player.player_id;
  const usingTimeBank = isTimerPlayer ? turnTimer.usingTimeBank : false;

  useEffect(() => {
    if (!isTimerPlayer || !turnTimer) {
      setTimerPercent(100);
      return;
    }

    const totalTime = turnTimer.usingTimeBank ? turnTimer.timeBank : turnTimer.timeLimit;
    if (totalTime <= 0) {
      setTimerPercent(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - turnTimer.startedAt) / 1000;
      const remaining = Math.max(0, totalTime - elapsed);
      setTimerPercent((remaining / totalTime) * 100);
    }, 50);

    return () => clearInterval(interval);
  }, [isTimerPlayer, turnTimer]);

  function handleAvatarClick() {
    if (isMe) {
      // Open file picker for avatar upload
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.jpg,.jpeg,.png,.gif,.webp';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            const res = await api.uploadAvatar(sessionId, file);
            useStore.getState().setAvatarUrl(res.avatar_url);
          } catch (err) {
            console.error('Avatar upload failed', err);
          }
        }
      };
      input.click();
    } else {
      setShowMenu(true);
      clearTimeout(menuTimeout.current);
      menuTimeout.current = setTimeout(() => setShowMenu(false), 3000);
    }
  }

  const avatarSrc = player.avatar_url || undefined;

  return (
    <div
      className={`player-seat ${isMe ? 'is-me' : ''} ${isCurrentTurn ? 'active-turn' : ''} ${player.away ? 'away' : ''} ${player.status}`}
      style={{ left: position.left, top: position.top }}
    >
      {/* Avatar */}
      <div className="player-avatar-container" onClick={handleAvatarClick}>
        {avatarSrc ? (
          <img src={avatarSrc} alt={player.nickname} className="player-avatar" />
        ) : (
          <div className="player-avatar player-avatar-default">
            <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        )}

        {/* Status badges */}
        {player.away && <div className="badge badge-afk">AFK</div>}
        {player.status === 'allin' && <div className="badge badge-allin">ALL IN</div>}
        {player.status === 'bust' && <div className="badge badge-bust">BUST</div>}
        {isDealer && <div className="badge badge-dealer">D</div>}
      </div>

      {/* Info */}
      <div className="player-info">
        <span className="player-nickname">{player.nickname}</span>
        <span className="player-stack">{player.stack}</span>
      </div>

      {/* Timer bar */}
      {isCurrentTurn && (
        <div className="timer-bar-container">
          <div
            className={`timer-bar-fill ${usingTimeBank ? 'time-bank' : ''}`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      )}

      {/* Bet */}
      {player.bet > 0 && (
        <motion.div
          className="player-bet"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          {player.bet}
        </motion.div>
      )}

      {/* Cards */}
      <div className="player-cards">
        <AnimatePresence>
          {player.hole_cards && player.hole_cards.length > 0 && (!isMe || player.status === 'allin' || ((gameState?.stage === 'showdown' || gameState?.stage === 'waiting') && player.status !== 'folded')) ? (
            // Show actual cards — server sends them when visible (showdown, post-hand, or own allin)
            player.hole_cards.map((card, i) => (
              <motion.div
                key={`show-${card}-${i}`}
                initial={{ opacity: 0, rotateY: 180 }}
                animate={{ opacity: 1, rotateY: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <CardDisplay card={card} size="small" />
              </motion.div>
            ))
          ) : !isMe && player.revealed_cards?.length ? (
            // Revealed cards
            <>
              {player.revealed_cards.map((card, i) => (
                <CardDisplay key={i} card={card} size="small" />
              ))}
              {player.revealed_cards.length < 2 && (
                <CardDisplay card="" size="small" faceDown />
              )}
            </>
          ) : !isMe && gameState?.stage && gameState.stage !== 'waiting' && player.status !== 'bust' && player.status !== 'folded' ? (
            <>
              {[0, 1].map((i) => (
                <motion.div
                  key={`back-${i}-${gameState?.round_number}`}
                  initial={{ opacity: 0, y: -30, scale: 0.5 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <CardDisplay card="" size="small" faceDown />
                </motion.div>
              ))}
            </>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Context menu */}
      {showMenu && !isMe && (
        <PlayerContextMenu
          player={player}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}
