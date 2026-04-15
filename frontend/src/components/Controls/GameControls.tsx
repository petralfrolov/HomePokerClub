import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { S } from '../../strings';
import './Controls.css';

export function GameControls() {
  const sessionId = useStore((s) => s.sessionId);
  const gameState = useStore((s) => s.gameState);
  const tableId = useStore((s) => s.tableId);
  const tableConfig = useStore((s) => s.tableConfig);
  const rebuyWindow = useStore((s) => s.rebuyWindow);
  const [raiseAmount, setRaiseAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const prevStageRef = useRef<string | null>(null);
  const [rebuyAmount, setRebuyAmount] = useState<number>(0);
  const [rebuyTimeLeft, setRebuyTimeLeft] = useState<number>(0);
  const dragRef = useRef<HTMLDivElement>(null);
  const DRAG_STORAGE_KEY = 'controls-drag-position';
  const savedPos = (() => { try { const v = localStorage.getItem(DRAG_STORAGE_KEY); return v ? JSON.parse(v) : { x: 0, y: 0 }; } catch { return { x: 0, y: 0 }; } })();
  const dragPositionRef = useRef<{ x: number; y: number }>(savedPos);
  const navigate = useNavigate();
  const setTableId = useStore((s) => s.setTableId);
  const setGameState = useStore((s) => s.setGameState);
  const [hasRequestedRebuy, setHasRequestedRebuy] = useState(false);

  // Rebuy window countdown (must be before any early returns)
  const myPlayer = gameState?.players.find((p) => p.session_id === sessionId);
  const isBustInWindow = myPlayer?.status === 'bust' && rebuyWindow
    && rebuyWindow.bustPlayerIds.includes(myPlayer.player_id);

  useEffect(() => {
    if (!isBustInWindow || !rebuyWindow) {
      setRebuyTimeLeft(0);
      return;
    }
    const update = () => {
      const elapsed = (Date.now() - rebuyWindow.startedAt) / 1000;
      const left = Math.max(0, rebuyWindow.timeout - elapsed);
      setRebuyTimeLeft(left);
      if (left === 0 && !hasRequestedRebuy) {
        // Don't call leaveTable — the server removes bust players after
        // the rebuy window closes and adds them to the ledger
        setTableId(null);
        setGameState(null);
        navigate('/');
      }
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [isBustInWindow, rebuyWindow, hasRequestedRebuy, navigate, setTableId, setGameState]);

  // Reset rebuy request state when a new rebuy window opens
  useEffect(() => {
    if (rebuyWindow) {
      setHasRequestedRebuy(false);
    }
  }, [rebuyWindow]);

  // Navigate home if rebuy window closed but player is still bust after requesting rebuy
  useEffect(() => {
    if (myPlayer?.status === 'bust' && hasRequestedRebuy && rebuyWindow === null) {
      const timeout = setTimeout(() => {
        const cur = useStore.getState().gameState?.players.find(
          (p) => p.session_id === useStore.getState().sessionId
        );
        if (cur?.status === 'bust') {
          setTableId(null);
          setGameState(null);
          navigate('/');
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [myPlayer?.status, hasRequestedRebuy, rebuyWindow, navigate, setTableId, setGameState]);

  // Reset raise slider when the street (stage) or round changes
  const stageKey = `${gameState?.round_number}-${gameState?.stage}`;
  useEffect(() => {
    if (prevStageRef.current !== null && prevStageRef.current !== stageKey) {
      setRaiseAmount(0);
    }
    prevStageRef.current = stageKey;
  }, [stageKey]);

  if (!gameState || !tableId) return null;
  if (!myPlayer) return null;

  const isMyTurn = gameState.current_player_seat === myPlayer.seat_index;
  const bb = gameState.blind_big;

  // Show rebuy button for bust players even when it's not their turn
  if (myPlayer.status === 'bust') {
    const minBuyin = tableConfig?.min_buyin || bb * 10;
    const maxBuyin = tableConfig?.max_buyin || bb * 100;
    const defaultAmount = rebuyAmount || minBuyin;
    const timeoutFraction = rebuyWindow ? rebuyTimeLeft / rebuyWindow.timeout : 0;
    return (
      <motion.div
        className="game-controls"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="controls-main rebuy-main">
          <div className="rebuy-controls-row">
            <span className="rebuy-value-display">💰 {defaultAmount}</span>
            <span className="rebuy-range-hint">{minBuyin}–{maxBuyin}</span>
            <button
              className="control-btn-small rebuy-btn"
              disabled={hasRequestedRebuy}
              onClick={async () => {
                try {
                  await api.requestRebuy(tableId!, { session_id: sessionId, amount: defaultAmount });
                  setHasRequestedRebuy(true);
                } catch (e: any) {
                  alert(e.message);
                }
              }}
            >
              {hasRequestedRebuy ? S.rebuyWaiting : S.rebuyBtn}
            </button>
          </div>
          <input
            type="range"
            className="rebuy-slider"
            min={minBuyin}
            max={maxBuyin}
            step={bb}
            value={defaultAmount}
            onChange={(e) => setRebuyAmount(parseInt(e.target.value))}
          />
          {isBustInWindow && (
            <div className="rebuy-timer-bar-container">
              <div
                className="rebuy-timer-bar"
                style={{ width: `${timeoutFraction * 100}%` }}
              />
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Only hide the panel entirely when there's no active hand or player is bust/folded
  const inActiveHand = !!gameState.stage && gameState.stage !== 'waiting';
  const hasCards = myPlayer.hole_cards && myPlayer.hole_cards.length > 0;
  const canAct = isMyTurn && myPlayer.status === 'active' && hasCards;

  // AFK/sitting_out player: show return button
  if (myPlayer.away || myPlayer.status === 'sitting_out') {
    return (
      <motion.div
        className="game-controls"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="controls-main">
          <div className="controls-secondary" style={{ opacity: 1 }}>
            <button
              className="control-btn-small"
              onClick={async () => {
                try {
                  await api.setAway(tableId!, { session_id: sessionId, away: false });
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              {S.returnToGame}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!inActiveHand || myPlayer.status === 'folded' || !hasCards) return null;

  const canCheck = gameState.current_bet <= (myPlayer.bet || 0);
  const callAmount = Math.min(gameState.current_bet - (myPlayer.bet || 0), myPlayer.stack);
  const sb = gameState.blind_small;
  const minRaise = gameState.current_bet + (gameState.min_raise || bb);
  const maxRaise = myPlayer.stack + (myPlayer.bet || 0);

  // SB-discrete steps for the slider
  const raiseSteps: number[] = [];
  for (let v = minRaise; v <= maxRaise; v += sb) {
    raiseSteps.push(v);
  }
  // Always include max (all-in) if not already there
  if (raiseSteps.length === 0 || raiseSteps[raiseSteps.length - 1] < maxRaise) {
    raiseSteps.push(maxRaise);
  }

  // Find closest step index for current raise amount
  function closestStepIndex(val: number): number {
    let best = 0;
    for (let i = 1; i < raiseSteps.length; i++) {
      if (Math.abs(raiseSteps[i] - val) < Math.abs(raiseSteps[best] - val)) best = i;
    }
    return best;
  }

  // Effective raise: clamp to valid range
  const effectiveRaise = raiseAmount ? Math.max(raiseAmount, minRaise) : minRaise;

  // Pot-based raise presets (rounded to SB multiples)
  const roundToSB = (val: number) => Math.round(val / sb) * sb;
  const halfPotRaise = Math.max(minRaise, Math.min(maxRaise, roundToSB(gameState.pot / 2)));
  const fullPotRaise = Math.max(minRaise, Math.min(maxRaise, roundToSB(gameState.pot)));

  async function doAction(action: string, amount?: number) {
    setLoading(true);
    try {
      await api.gameAction(tableId!, {
        session_id: sessionId,
        action,
        amount,
      });
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAway() {
    try {
      const wantAway = !(myPlayer!.away || myPlayer!.pending_away);
      await api.setAway(tableId!, { session_id: sessionId, away: wantAway });
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <motion.div
      ref={dragRef}
      className="game-controls"
      drag
      dragMomentum={false}
      dragElastic={0}
      initial={false}
      style={{ x: dragPositionRef.current.x, y: dragPositionRef.current.y, cursor: 'grab' }}
      onDragEnd={(_e, info) => {
        dragPositionRef.current.x += info.offset.x;
        dragPositionRef.current.y += info.offset.y;
        try { localStorage.setItem('controls-drag-position', JSON.stringify(dragPositionRef.current)); } catch {}
      }}
      whileDrag={{ cursor: 'grabbing' }}
    >
      <div className="controls-main" style={{ opacity: canAct ? 1 : 0.45, pointerEvents: canAct ? 'auto' : 'none' }}>
        <div className="controls-drag-handle" style={{ pointerEvents: 'auto' }}>⠿</div>
        {/* Always-visible raise slider */}
        <div className="raise-slider-container">
          <div className="raise-presets-row">
            <button
              className="raise-preset-btn"
              onClick={() => setRaiseAmount(halfPotRaise)}
              disabled={loading}
            >{S.halfPot}</button>
            <button
              className="raise-preset-btn"
              onClick={() => setRaiseAmount(fullPotRaise)}
              disabled={loading}
            >{S.pot}</button>
          </div>
          <div className="raise-slider-row">
            <button
              className="raise-step-btn"
              onClick={() => setRaiseAmount(raiseSteps[Math.max(0, closestStepIndex(effectiveRaise) - 1)])}
            >−</button>
            <input
              type="range"
              className="raise-slider"
              min={0}
              max={raiseSteps.length - 1}
              step={1}
              value={closestStepIndex(effectiveRaise)}
              onChange={(e) => setRaiseAmount(raiseSteps[parseInt(e.target.value)])}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <button
              className="raise-step-btn"
              onClick={() => setRaiseAmount(raiseSteps[Math.min(raiseSteps.length - 1, closestStepIndex(effectiveRaise) + 1)])}
            >+</button>
            <span className="raise-value">{effectiveRaise}</span>
          </div>
        </div>

        <div className="controls-row">
          <button
            className="control-btn fold-btn"
            onClick={() => doAction('fold')}
            disabled={loading}
          >
            {S.fold}
          </button>

          {canCheck ? (
            <button
              className="control-btn check-btn"
              onClick={() => doAction('check')}
              disabled={loading}
            >
              {S.check}
            </button>
          ) : (
            <button
              className="control-btn call-btn"
              onClick={() => doAction('call')}
              disabled={loading}
            >
              {S.call} {callAmount}
              {gameState.pot > 0 && (
                <span className="btn-pot-pct">{Math.round((callAmount / gameState.pot) * 100)}%</span>
              )}
            </button>
          )}

          <button
            className="control-btn raise-confirm-btn"
            onClick={() => doAction('raise', effectiveRaise)}
            disabled={loading}
          >
            {S.raise} {effectiveRaise}
            {gameState.pot > 0 && (
              <span className="btn-pot-pct">{Math.round((effectiveRaise / gameState.pot) * 100)}%</span>
            )}
          </button>

          <button
            className="control-btn allin-btn"
            onClick={() => doAction('allin')}
            disabled={loading}
          >
            {S.allIn} {myPlayer.stack}
          </button>
        </div>

        <div className="controls-secondary" style={{ pointerEvents: 'auto', opacity: 1 }}>
          <button className="control-btn-small" onClick={handleAway}>
            {myPlayer.away ? S.returnBack : myPlayer.pending_away ? S.cancelAway : S.goAway}
          </button>

          {myPlayer.stack === 0 && (
            <button
              className="control-btn-small rebuy-btn"
              onClick={async () => {
                try {
                  await api.requestRebuy(tableId!, { session_id: sessionId, amount: bb * 20 });
                } catch (e: any) {
                  alert(e.message);
                }
              }}
            >
              {S.buyChips}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
