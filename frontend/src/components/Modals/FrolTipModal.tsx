import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { FrolTipRequest } from '../../types';
import { S } from '../../strings';
import './Modals.css';

export function FrolTipModal() {
  const frolReq = useStore((s) => s.frolTipRequest);
  const setFrolTipRequest = useStore((s) => s.setFrolTipRequest);
  const sessionId = useStore((s) => s.sessionId);
  const tableId = useStore((s) => s.tableId);
  const gameState = useStore((s) => s.gameState);

  const [tipPercent, setTipPercent] = useState(50);
  const [timeLeft, setTimeLeft] = useState(15);
  const [declinePos, setDeclinePos] = useState({ x: 0, y: 0 });
  const [declinePosIdx, setDeclinePosIdx] = useState(0);

  useEffect(() => {
    if (!frolReq) return;
    setTimeLeft(frolReq.tip_timeout);
    setTipPercent(frolReq.min_tip_percent);

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // Auto-tip at min percent
          handleTip(frolReq.min_tip_percent);
          clearInterval(timer);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [frolReq]);

  // Flying button positions
  useEffect(() => {
    if (!frolReq || frolReq.decline_button_type !== 'flying') return;
    const positions = [
      { x: 100, y: 50 }, { x: -150, y: 100 }, { x: 200, y: -50 },
      { x: -100, y: -100 }, { x: 50, y: 150 }, { x: -200, y: 50 },
      { x: 150, y: -150 }, { x: -50, y: 200 },
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % positions.length;
      setDeclinePos(positions[idx]);
      setDeclinePosIdx(idx);
    }, 2000);
    return () => clearInterval(interval);
  }, [frolReq]);

  const handleTip = useCallback(async (percent?: number) => {
    if (!frolReq || !tableId) return;
    const p = percent ?? tipPercent;
    const amount = Math.floor((frolReq.pot * p) / 100);
    try {
      await api.frolTip(tableId, { session_id: sessionId, amount });
    } catch (e) {
      console.error(e);
    }
    setFrolTipRequest(null);
  }, [frolReq, tableId, sessionId, tipPercent, setFrolTipRequest]);

  const handleDecline = useCallback(async () => {
    if (!frolReq || !tableId) return;

    // All decline types go through the backend decline endpoint.
    // For 'trick', the backend charges max_tip_percent.
    // For 'flying'/'invisible', the backend does a real decline.
    try {
      await api.frolDecline(tableId, sessionId);
    } catch (e) {
      console.error(e);
    }
    setFrolTipRequest(null);
  }, [frolReq, tableId, sessionId, setFrolTipRequest]);

  if (!frolReq) return null;

  const tipAmount = Math.floor((frolReq.pot * tipPercent) / 100);

  return (
    <div className="modal-overlay frol-modal-overlay">
      <motion.div
        className="modal frol-modal"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className="frol-header">
          <img src="/static/dealer_avatars/frol.png" alt={S.dealerNames.frol} className="frol-avatar" />
          <h3>{S.frolWorkedGreat}</h3>
          <p>{S.leaveTip}</p>
        </div>

        <div className="frol-timer">⏱ {timeLeft}с</div>

        <div className="frol-slider">
          <input
            type="range"
            min={frolReq.decline_button_type === 'trick' ? 0 : frolReq.min_tip_percent}
            max={frolReq.max_tip_percent}
            step={frolReq.tip_step}
            value={tipPercent}
            onChange={(e) => setTipPercent(parseInt(e.target.value))}
          />
          <div className="frol-tip-amount">
            {tipPercent}% = {tipAmount} {S.chips}
          </div>
        </div>

        <button className="btn-primary frol-tip-btn" onClick={() => handleTip()}>
          {S.giveTip} ({tipAmount})
        </button>

        {/* Decline button variants */}
        {frolReq.decline_button_type === 'flying' && (
          <motion.button
            className="btn-secondary frol-decline-flying"
            animate={{ x: declinePos.x, y: declinePos.y }}
            transition={{ duration: 0.3 }}
            onClick={handleDecline}
          >
            {S.decline}
          </motion.button>
        )}

        {frolReq.decline_button_type === 'invisible' && (
          <button
            className="frol-decline-invisible"
            onClick={handleDecline}
          >
            {S.decline}
          </button>
        )}

        {frolReq.decline_button_type === 'trick' && (
          <div className="frol-trick-container">
            <button className="btn-secondary" onClick={handleDecline}>
              Отказаться*
            </button>
            <div className="frol-trick-disclaimer">
              * Нажимая «Отказаться», вы подтверждаете согласие с максимальным чаевым
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
