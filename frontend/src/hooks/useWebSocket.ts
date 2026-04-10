import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { WsEvent } from '../types';
import { playSound } from './useSound';

export function useWebSocket(tableId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const sessionId = useStore((s) => s.sessionId);
  const setGameState = useStore((s) => s.setGameState);
  const setFrolTipRequest = useStore((s) => s.setFrolTipRequest);
  const setPendingRebuy = useStore((s) => s.setPendingRebuy);
  const setDanilkaEvent = useStore((s) => s.setDanilkaEvent);
  const setTurnTimer = useStore((s) => s.setTurnTimer);
  const setRebuyWindow = useStore((s) => s.setRebuyWindow);
  const setCashoutPending = useStore((s) => s.setCashoutPending);
  const setStallingAccused = useStore((s) => s.setStallingAccused);

  const connect = useCallback(() => {
    if (!tableId || !sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${tableId}?session_id=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WS connected');
    };

    ws.onmessage = (evt) => {
      try {
        const data: WsEvent = JSON.parse(evt.data);
        handleEvent(data);
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    ws.onclose = () => {
      console.log('WS disconnected');
      // Reconnect after 2 seconds
      setTimeout(() => connect(), 2000);
    };

    // Keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [tableId, sessionId]);

  const handleEvent = useCallback((data: WsEvent) => {
    switch (data.event) {
      case 'game_state':
        setGameState(data as any);
        break;
      case 'frol_tip_request':
        setFrolTipRequest(data as any);
        break;
      case 'rebuy_requested':
        setPendingRebuy(data as any);
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
      case 'stalling_accused': {
        const myPlayer = useStore.getState().gameState?.players.find(
          (p) => p.session_id === sessionId
        );
        if (myPlayer && data.target_id === myPlayer.player_id) {
          setStallingAccused(true);
          setTimeout(() => setStallingAccused(false), 4000);
        }
        break;
      }
      case 'cards_dealt':
        playSound('card_received');
        break;
      case 'blinds_raised':
        playSound('blinds_up');
        break;
      case 'rebuy_approved':
        playSound('rebuy');
        break;
      case 'round_end': {
        setTurnTimer(null);
        const myP = useStore.getState().gameState?.players.find(
          (p) => p.session_id === useStore.getState().sessionId
        );
        if (myP && data.winners?.some((w: any) => w.player_id === myP.player_id)) {
          playSound('win');
        } else if (myP && myP.status !== 'folded') {
          playSound('lose');
        }
        break;
      }
      case 'action_made': {
        const act = data.action;
        if (act === 'fold') playSound('fold');
        else if (act === 'check') playSound('check');
        else if (act === 'allin') playSound('allin');
        break;
      }
      case 'community_cards':
      case 'player_joined':
      case 'player_left':
      case 'pot_update':
      case 'card_revealed':
      case 'player_away':
      case 'tip_given':
      case 'rebuy_denied':
      case 'player_avatar_updated':
        // These events trigger game_state refresh from server
        break;
      default:
        console.log('Unknown WS event:', data.event);
    }
  }, [setGameState, setFrolTipRequest, setPendingRebuy, setDanilkaEvent, setTurnTimer, setRebuyWindow, setCashoutPending, setStallingAccused]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
