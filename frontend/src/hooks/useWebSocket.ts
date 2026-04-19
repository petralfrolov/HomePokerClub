import { useEffect, useRef, useCallback } from 'react';
import { useStore, toast } from '../store/useStore';
import { WsEvent } from '../types';
import { playSound } from './useSound';
import type { ConnectionStatus } from '../store/uiSlice';

const PING_INTERVAL_MS = 20_000;
const PONG_TIMEOUT_MS = 45_000; // consider half-open if no pong for this long
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function useWebSocket(tableId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const sessionId = useStore((s) => s.sessionId);
  const setGameState = useStore((s) => s.setGameState);
  const setFrolTipRequest = useStore((s) => s.setFrolTipRequest);
  const addApproval = useStore((s) => s.addApproval);
  const removeApprovalByPlayer = useStore((s) => s.removeApprovalByPlayer);
  const setDanilkaEvent = useStore((s) => s.setDanilkaEvent);
  const setTurnTimer = useStore((s) => s.setTurnTimer);
  const setRebuyWindow = useStore((s) => s.setRebuyWindow);
  const setCashoutPending = useStore((s) => s.setCashoutPending);
  const setStallingAccused = useStore((s) => s.setStallingAccused);
  const setWinnerPlayerIds = useStore((s) => s.setWinnerPlayerIds);

  const handleEvent = useCallback((data: WsEvent) => {
    switch (data.event) {
      case 'game_state':
        setGameState(data as any);
        break;
      case 'frol_tip_request':
        setFrolTipRequest(data as any);
        playSound('frol_tips');
        break;
      case 'rebuy_requested':
        addApproval({
          kind: 'rebuy',
          request_id: (data as any).request_id,
          player_id: (data as any).player_id,
          amount: (data as any).amount,
        });
        break;
      case 'join_requested':
        addApproval({
          kind: 'join',
          request_id: (data as any).request_id,
          player_id: (data as any).player_id,
          amount: (data as any).amount,
          nickname: (data as any).nickname,
        });
        break;
      case 'danilka_event':
        setDanilkaEvent(true);
        setTimeout(() => setDanilkaEvent(false), 5000);
        break;
      case 'turn_started': {
        setTurnTimer({
          playerId: data.player_id,
          timeLimit: data.time_limit,
          timeBank: data.time_bank,
          usingTimeBank: false,
          startedAt: Date.now(),
        });
        const me = useStore.getState().gameState?.players.find(
          (p) => p.session_id === useStore.getState().sessionId
        );
        if (me && data.player_id === me.player_id) {
          playSound('your_turn');
        }
        break;
      }
      case 'time_bank_update':
        setTurnTimer({
          playerId: data.player_id,
          timeLimit: 0,
          timeBank: data.time_bank,
          usingTimeBank: true,
          startedAt: Date.now(),
        });
        break;
      case 'game_over':
        setTurnTimer(null);
        break;
      case 'rebuy_window':
        setRebuyWindow({
          bustPlayerIds: data.bust_player_ids,
          timeout: data.timeout,
          startedAt: Date.now(),
        });
        break;
      case 'rebuy_window_closed':
        setRebuyWindow(null);
        break;
      case 'cashout_pending':
        setCashoutPending(true);
        break;
      case 'table_deleted': {
        useStore.getState().setTableId(null);
        useStore.getState().setGameState(null);
        try { wsRef.current?.close(1000, 'table_deleted'); } catch { /* ignore */ }
        break;
      }
      case 'you_were_kicked': {
        try { wsRef.current?.close(1000, 'kicked'); } catch { /* ignore */ }
        useStore.getState().setShowKickedOverlay(true);
        playSound('kick');
        setTimeout(() => {
          useStore.getState().setShowKickedOverlay(false);
          useStore.getState().setTableId(null);
          useStore.getState().setTableConfig(null);
          useStore.getState().setGameState(null);
          useStore.getState().setKicked(data.cashout ?? 0);
        }, 3000);
        break;
      }
      case 'stalling_accused': {
        const myPlayer = useStore.getState().gameState?.players.find(
          (p) => p.session_id === useStore.getState().sessionId
        );
        if (myPlayer && data.target_id === myPlayer.player_id) {
          setStallingAccused(true);
          setTimeout(() => setStallingAccused(false), 4000);
        }
        break;
      }
      case 'cards_dealt':
        setWinnerPlayerIds([]);
        playSound('card_received');
        break;
      case 'blinds_raised':
        playSound('blinds_up');
        break;
      case 'rebuy_approved':
        removeApprovalByPlayer((data as any).player_id, 'rebuy');
        playSound('rebuy');
        break;
      case 'round_end': {
        setTurnTimer(null);
        const winners: string[] = (data.winners || []).map((w: any) => w.player_id);
        setWinnerPlayerIds(winners);
        const myP = useStore.getState().gameState?.players.find(
          (p) => p.session_id === useStore.getState().sessionId
        );
        if (myP && winners.includes(myP.player_id)) {
          playSound('win');
        } else if (myP && myP.status !== 'folded') {
          playSound('lose');
        }
        break;
      }
      case 'action_made': {
        const act = data.action;
        const actorId: string | undefined = (data as any).player_id;
        const me = useStore.getState().gameState?.players.find(
          (p) => p.session_id === useStore.getState().sessionId
        );
        const isMe = !!me && actorId === me.player_id;
        if (data.auto) {
          if (act === 'fold') playSound('fold', { opponent: !isMe });
          break;
        }
        if (act === 'allin') {
          playSound('allin');
        } else if (isMe) {
          if (act === 'fold') playSound('fold');
          else if (act === 'check') playSound('check');
          else if (act === 'call') playSound('call');
          else if (act === 'raise') playSound('raise');
        } else {
          if (act === 'fold') playSound('fold', { opponent: true });
          else if (act === 'check') playSound('check', { opponent: true });
          else if (act === 'call') playSound('call', { opponent: true });
          else if (act === 'raise') playSound('raise', { opponent: true });
        }
        break;
      }
      case 'tip_given':
        playSound('tips');
        break;
      case 'dealer_changed': {
        const currentConfig = useStore.getState().tableConfig;
        if (currentConfig) {
          useStore.getState().setTableConfig({
            ...currentConfig,
            dealer_type: data.dealer_type,
          });
        }
        break;
      }
      case 'player_away': {
        const curState = useStore.getState().gameState;
        if (curState) {
          setGameState({
            ...curState,
            players: curState.players.map((p) =>
              p.player_id === data.player_id
                ? { ...p, away: data.away, pending_away: data.pending_away ?? false }
                : p
            ),
          });
        }
        break;
      }
      case 'player_joined':
        playSound('player_joined');
        break;
      case 'player_left':
        playSound('player_left');
        break;
      case 'community_cards':
      case 'pot_update':
      case 'card_revealed':
        break;
      case 'rebuy_denied':
        removeApprovalByPlayer((data as any).player_id, 'rebuy');
        break;
      case 'join_approved':
        removeApprovalByPlayer((data as any).player_id, 'join');
        break;
      case 'join_denied': {
        removeApprovalByPlayer((data as any).player_id, 'join');
        // The rejected player is forced back to the lobby.
        try { wsRef.current?.close(1000, 'join_denied'); } catch { /* ignore */ }
        useStore.getState().setTableId(null);
        useStore.getState().setTableConfig(null);
        useStore.getState().setGameState(null);
        toast('Администратор отклонил вашу заявку на вход за стол', 'error', 4000);
        break;
      }
      case 'player_avatar_updated': {
        const curState = useStore.getState().gameState;
        if (curState) {
          setGameState({
            ...curState,
            players: curState.players.map((p) =>
              p.player_id === data.player_id ? { ...p, avatar_url: data.avatar_url } : p
            ),
          });
        }
        break;
      }
      case 'player_kicked': {
        const currentState = useStore.getState().gameState;
        if (currentState) {
          setGameState({
            ...currentState,
            players: currentState.players.filter((p) => p.player_id !== data.player_id),
          });
        }
        break;
      }
      default:
        console.log('Unknown WS event:', data.event);
    }
  }, [setGameState, setFrolTipRequest, addApproval, removeApprovalByPlayer, setDanilkaEvent, setTurnTimer, setRebuyWindow, setCashoutPending, setStallingAccused, setWinnerPlayerIds]);

  // Keep handleEvent accessible to the effect via a ref so effect deps stay minimal.
  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  useEffect(() => {
    if (!tableId || !sessionId) {
      useStore.getState().setConnectionStatus('idle');
      return;
    }

    // Local-to-effect mutable state — guarantees StrictMode double-mounts stay isolated
    // and no stale closures can drive a loop.
    let currentWs: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectAttempt = 0;
    let wasOnline = false;
    let lastPongAt = Date.now();
    let cancelled = false; // cleanup sets this — suppresses reconnects

    const setStatus = (s: ConnectionStatus) => useStore.getState().setConnectionStatus(s);

    const clearTimers = () => {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      if (reconnectTimer) return;
      const attempt = reconnectAttempt++;
      const base = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * Math.pow(2, attempt));
      const delay = base * (0.75 + Math.random() * 0.5);
      setStatus('reconnecting');
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!cancelled) openSocket();
      }, delay);
    };

    const openSocket = () => {
      if (cancelled) return;
      clearTimers();
      setStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/${tableId}?session_id=${sessionId}`;
      const ws = new WebSocket(wsUrl);
      currentWs = ws;
      wsRef.current = ws;
      lastPongAt = Date.now();

      ws.onopen = () => {
        if (cancelled || currentWs !== ws) return;
        console.log('WS connected');
        reconnectAttempt = 0;
        lastPongAt = Date.now();
        setStatus('online');
        if (wasOnline) {
          toast('Соединение восстановлено', 'success', 2500);
        }
        wasOnline = true;
      };

      ws.onmessage = (evt) => {
        if (cancelled) return;
        lastPongAt = Date.now(); // any frame counts as liveness signal
        try {
          const raw = JSON.parse(evt.data);
          if (raw && raw.type === 'pong') return;
          if (raw && raw.type === 'ping') {
            try { ws.send(JSON.stringify({ type: 'pong' })); } catch { /* ignore */ }
            return;
          }
          handleEventRef.current(raw as WsEvent);
        } catch (e) {
          console.error('WS parse error', e);
        }
      };

      ws.onerror = () => {
        // onclose fires after this — reconnect scheduling happens there
      };

      ws.onclose = () => {
        console.log('WS disconnected');
        if (currentWs === ws) currentWs = null;
        if (wsRef.current === ws) wsRef.current = null;
        clearTimers();
        if (cancelled) {
          setStatus('idle');
          return;
        }
        setStatus('offline');
        if (wasOnline && reconnectAttempt === 0) {
          toast('Соединение потеряно. Переподключение…', 'warning', 3000);
        }
        scheduleReconnect();
      };

      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
          if (Date.now() - lastPongAt > PONG_TIMEOUT_MS) {
            console.warn('WS half-open — forcing close');
            try { ws.close(); } catch { /* ignore */ }
          }
        }
      }, PING_INTERVAL_MS);
    };

    openSocket();

    return () => {
      cancelled = true;
      clearTimers();
      const ws = currentWs;
      currentWs = null;
      if (wsRef.current === ws) wsRef.current = null;
      if (ws) {
        // Detach handlers first so close() cannot re-enter scheduleReconnect.
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try { ws.close(1000, 'unmount'); } catch { /* ignore */ }
      }
      useStore.getState().setConnectionStatus('idle');
    };
  }, [tableId, sessionId]);

  return wsRef;
}
