import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, toast } from '../../store/useStore';
import { api } from '../../api';
import { S } from '../../strings';
import { playSound } from '../../hooks/useSound';
import './Modals.css';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Array<'s' | 'h' | 'd' | 'c'> = ['s', 'h', 'd', 'c'];
const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RED_SUITS = new Set(['h', 'd']);

const ANIM_STEP_MS = 250; // per-card dealing interval
const RESULT_REVEAL_DELAY_MS = 600; // grace period after the last card before showing the result
const FALLBACK_OFFER_TIMEOUT = 20;

function CardChip({ card, dim, highlight }: { card: string; dim?: boolean; highlight?: boolean }) {
  const rank = card[0];
  const suit = card[1];
  const isRed = RED_SUITS.has(suit);
  return (
    <div
      className={`shtos-card ${dim ? 'shtos-card-dim' : ''} ${highlight ? 'shtos-card-hl' : ''} ${isRed ? 'red' : 'black'}`}
    >
      <span className="shtos-card-rank">{rank}</span>
      <span className="shtos-card-suit">{SUIT_GLYPH[suit] ?? suit}</span>
    </div>
  );
}

/** A countdown progress bar for pending offers.  The server enforces the same
 *  20-second timeout and broadcasts `shtos_cancelled` when it expires, so the
 *  bar is purely informational — no client-side action is needed at zero. */
function OfferTimerBar({ totalSec, startedAt }: { totalSec: number; startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const elapsed = (now - startedAt) / 1000;
  const remaining = Math.max(0, totalSec - elapsed);
  const pct = Math.max(0, Math.min(100, (remaining / totalSec) * 100));
  return (
    <div className="shtos-timer">
      <div className="shtos-timer-row">
        <span>{S.shtosTimerHint}</span>
        <span className="shtos-timer-secs">{Math.ceil(remaining)}s</span>
      </div>
      <div className="shtos-timer-track">
        <div className="shtos-timer-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ShtosModal() {
  const shtos = useStore((s) => s.shtos);
  const setShtos = useStore((s) => s.setShtos);
  const sessionId = useStore((s) => s.sessionId);
  const tableId = useStore((s) => s.tableId);
  const gameState = useStore((s) => s.gameState);

  const myPlayer = gameState?.players.find((p) => p.session_id === sessionId);
  const myId = myPlayer?.player_id ?? null;

  const [animatedDealtCount, setAnimatedDealtCount] = useState(0);
  const [animDone, setAnimDone] = useState(false);
  const lastSoundedRef = useRef(0);

  // Drive the dealing animation when entering the animating phase.
  useEffect(() => {
    if (shtos?.phase === 'animating' && shtos.resolution) {
      setAnimatedDealtCount(0);
      setAnimDone(false);
      lastSoundedRef.current = 0;
      const total = shtos.resolution.deck_sequence.length;
      if (total === 0) {
        setAnimDone(true);
        return;
      }
      let i = 0;
      let revealTimeoutId: ReturnType<typeof setTimeout> | null = null;
      const id = setInterval(() => {
        i += 1;
        setAnimatedDealtCount(i);
        if (i >= total) {
          clearInterval(id);
          // Hold the final frame briefly so the matching card lands before
          // the result text + highlight appear — keeps the suspense.
          revealTimeoutId = setTimeout(() => setAnimDone(true), RESULT_REVEAL_DELAY_MS);
        }
      }, ANIM_STEP_MS);
      return () => {
        clearInterval(id);
        if (revealTimeoutId) clearTimeout(revealTimeoutId);
      };
    }
  }, [shtos?.phase, shtos?.resolution]);

  // Play card-dealt sound for every newly revealed card during the animation.
  useEffect(() => {
    if (shtos?.phase !== 'animating') return;
    if (animatedDealtCount > lastSoundedRef.current) {
      lastSoundedRef.current = animatedDealtCount;
      playSound('card_dealt', { dedupMs: 0 });
    }
  }, [animatedDealtCount, shtos?.phase]);

  const opponent = useMemo(() => {
    if (!shtos || !myId) return undefined;
    const oppId = shtos.offer.from_id === myId ? shtos.offer.to_id : shtos.offer.from_id;
    return gameState?.players.find((p) => p.player_id === oppId);
  }, [shtos, myId, gameState]);

  if (!shtos || !myId || !tableId) return null;

  const isInitiator = myId === shtos.offer.from_id;
  const isParticipant = isInitiator || myId === shtos.offer.to_id;
  if (!isParticipant) return null;

  const offerTimeout = shtos.offer.timeout ?? FALLBACK_OFFER_TIMEOUT;
  const offerStartedAt = shtos.offer.received_at ?? Date.now();

  // ---- Outgoing pending ----
  if (shtos.phase === 'pending_outgoing') {
    async function handleCancel() {
      try {
        await api.cancelShtos(tableId!, { session_id: sessionId, offer_id: shtos!.offer.offer_id });
      } catch (e: any) {
        toast(e?.message || 'Не удалось отменить', 'error');
      }
      setShtos(null);
    }
    return (
      <div className="modal-overlay shtos-overlay">
        <div className="modal shtos-modal">
          <h3>{S.shtosOutgoingTitle}</h3>
          <p>{S.shtosOutgoingHint(opponent?.nickname ?? '')}</p>
          <p className="shtos-amount">{S.shtosBetLabel}: <strong>{shtos.offer.amount}</strong></p>
          <OfferTimerBar totalSec={offerTimeout} startedAt={offerStartedAt} />
          <div className="modal-actions">
            <button className="btn-secondary" onClick={handleCancel}>{S.shtosCancelOffer}</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Incoming pending ----
  if (shtos.phase === 'pending_incoming') {
    async function handleAccept() {
      try {
        await api.acceptShtos(tableId!, { session_id: sessionId, offer_id: shtos!.offer.offer_id });
      } catch (e: any) {
        toast(e?.message || 'Не удалось принять штос', 'error');
      }
    }
    async function handleDecline() {
      try {
        await api.declineShtos(tableId!, { session_id: sessionId, offer_id: shtos!.offer.offer_id });
      } catch (e: any) {
        toast(e?.message || 'Не удалось отклонить штос', 'error');
      }
      setShtos(null);
    }
    return (
      <div className="modal-overlay shtos-overlay">
        <div className="modal shtos-modal">
          <h3>{S.shtosIncomingTitle}</h3>
          <p>{S.shtosIncomingHint(opponent?.nickname ?? '', shtos.offer.amount)}</p>
          <p className="shtos-decline-warning">{S.shtosDeclineWarning}</p>
          <OfferTimerBar totalSec={offerTimeout} startedAt={offerStartedAt} />
          <div className="modal-actions">
            <button className="btn-secondary" onClick={handleDecline}>{S.shtosDecline}</button>
            <button className="btn-primary" onClick={handleAccept}>{S.shtosAccept}</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Card-pick phase ----
  if (shtos.phase === 'card_pick') {
    const isPicker = shtos.picker_id === myId;
    const pickerPlayer = gameState?.players.find((p) => p.player_id === shtos.picker_id);
    const deck = shtos.deck ?? RANKS.flatMap((r) => SUITS.map((s) => r + s));
    async function handlePick(card: string) {
      if (!isPicker) return;
      try {
        await api.pickShtosCard(tableId!, {
          session_id: sessionId,
          offer_id: shtos!.offer.offer_id,
          card,
        });
      } catch (e: any) {
        toast(e?.message || 'Не удалось выбрать карту', 'error');
      }
    }
    return (
      <div className="modal-overlay shtos-overlay">
        <div className="modal shtos-modal shtos-modal-wide">
          <h3>{isPicker ? S.shtosCardPickTitleYou : S.shtosCardPickTitleOther(pickerPlayer?.nickname ?? '')}</h3>
          {isPicker && <p className="shtos-hint">{S.shtosCardPickHint}</p>}
          <div className={`shtos-deck-grid ${isPicker ? '' : 'shtos-deck-grid-disabled'}`}>
            {deck.map((card) => (
              <button
                key={card}
                className="shtos-deck-card"
                disabled={!isPicker}
                onClick={() => handlePick(card)}
                aria-label={card}
              >
                <CardChip card={card} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Animating + Resolved ----
  if ((shtos.phase === 'animating' || shtos.phase === 'resolved') && shtos.resolution) {
    const r = shtos.resolution;
    const dealt = r.deck_sequence.slice(0, animatedDealtCount);
    // Reconstruct piles from dealt order: even-index → banker, odd → picker.
    const dealtBanker = dealt.filter((_, i) => i % 2 === 0);
    const dealtPicker = dealt.filter((_, i) => i % 2 === 1);

    // Map piles to "mine" vs "opponent" from THIS viewer's perspective so
    // both participants see their own cards on the labelled "your side".
    const isPicker = r.picker_id === myId;
    const myDealt = isPicker ? dealtPicker : dealtBanker;
    const oppDealt = isPicker ? dealtBanker : dealtPicker;
    const myPileLabel: 'picker' | 'banker' = isPicker ? 'picker' : 'banker';
    const oppPileLabel: 'picker' | 'banker' = isPicker ? 'banker' : 'picker';
    const myWon = r.winner_id === myId;
    const pickedSuitGlyph = SUIT_GLYPH[r.picked_card[1]] ?? r.picked_card[1];

    function handleClose() {
      setShtos(null);
    }

    return (
      <div className="modal-overlay shtos-overlay">
        <div className="modal shtos-modal shtos-modal-wide">
          <h3>{animDone ? (myWon ? S.shtosResultWin(r.amount) : S.shtosResultLose(r.amount)) : S.shtosAnimatingTitle}</h3>
          {!animDone && <p className="shtos-hint">{S.shtosAnimatingHint(r.picked_card[0] + pickedSuitGlyph)}</p>}

          <div className="shtos-arena">
            <div className="shtos-pile">
              <div className="shtos-pile-label">{S.shtosPickerSide}</div>
              <div className="shtos-pile-cards">
                {myDealt.map((c, i, arr) => (
                  <CardChip
                    key={`m-${c}-${i}`}
                    card={c}
                    highlight={animDone && i === arr.length - 1 && r.matching_card === c && r.matching_pile === myPileLabel}
                  />
                ))}
              </div>
            </div>

            <div className="shtos-picked">
              <div className="shtos-pile-label">{S.shtosPickedCard}</div>
              <CardChip card={r.picked_card} highlight />
              <div className="shtos-amount">{r.amount}</div>
            </div>

            <div className="shtos-pile">
              <div className="shtos-pile-label">
                {opponent?.nickname ? `${S.shtosBankerSide} (${opponent.nickname})` : S.shtosBankerSide}
              </div>
              <div className="shtos-pile-cards">
                {oppDealt.map((c, i, arr) => (
                  <CardChip
                    key={`o-${c}-${i}`}
                    card={c}
                    highlight={animDone && i === arr.length - 1 && r.matching_card === c && r.matching_pile === oppPileLabel}
                  />
                ))}
              </div>
            </div>
          </div>

          {animDone && (
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleClose}>{S.shtosClose}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
