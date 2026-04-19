import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { playSound } from '../../hooks/useSound';
import { api } from '../../api';
import { S } from '../../strings';
import { PokerTable } from './PokerTable';
import { PlayerSeat } from '../Player/PlayerSeat';
import { GameControls } from '../Controls/GameControls';
import { DealerAvatar } from '../Dealer/DealerAvatar';
import { FrolTipModal } from '../Modals/FrolTipModal';
import { ApprovalModal } from '../Modals/ApprovalModal';
import { DanilkaOverlay } from '../Dealer/DanilkaOverlay';
import { CommunityCards } from './CommunityCards';
import { SettingsPanel } from '../Controls/SettingsPanel';
import { HotkeysPanel } from '../Controls/HotkeysPanel';
import { CashoutLedgerEntry, GameLogEntry } from '../../types';
import { formatChips } from '../../formatChips';
import './Table.css';

export function TableView() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const sessionId = useStore((s) => s.sessionId);
  const gameState = useStore((s) => s.gameState);
  const tableConfig = useStore((s) => s.tableConfig);
  const setTableId = useStore((s) => s.setTableId);
  const setTableConfig = useStore((s) => s.setTableConfig);
  const danilkaEvent = useStore((s) => s.danilkaEvent);
  const stallingAccused = useStore((s) => s.stallingAccused);
  const kickedCashout = useStore((s) => s.kickedCashout);
  const clearAfkTable = useStore((s) => s.clearAfkTable);
  const setGameState = useStore((s) => s.setGameState);
  const displayInBB = useStore((s) => s.displayInBB);
  const [ledgerCollapsed, setLedgerCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  useWebSocket(tableId || null);

  // Navigate to lobby when kicked
  useEffect(() => {
    if (kickedCashout !== null) {
      navigate('/');
    }
  }, [kickedCashout, navigate]);

  useEffect(() => {
    if (!tableId) return;
    setTableId(tableId);
    clearAfkTable();
    // Clear stale game state from previous table
    setGameState(null);

    api.getTable(tableId).then((data) => {
      setTableConfig(data);
    }).catch(() => {
      navigate('/');
    });

    return () => {
      setTableId(null);
      setTableConfig(null);
      setGameState(null);
    };
  }, [tableId]);

  useEffect(() => {
    if (stallingAccused) playSound('stalling');
  }, [stallingAccused]);

  if (!tableId) return null;

  // Sort players by seat_index to ensure clockwise visual order
  const sortedPlayers = [...(gameState?.players || [])].sort((a, b) => a.seat_index - b.seat_index);
  const isAdmin = tableConfig?.admin_session_id === sessionId;
  const isWaiting = gameState?.stage === 'waiting' || !gameState?.stage;

  // Reorder players so current user is always at the bottom (index 0)
  const myIndex = sortedPlayers.findIndex((p) => p.session_id === sessionId);
  const reorderedPlayers = myIndex >= 0
    ? [...sortedPlayers.slice(myIndex), ...sortedPlayers.slice(0, myIndex)]
    : sortedPlayers;

  async function handleStart() {
    try {
      await api.startGame(tableId!, sessionId);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleCashout() {
    if (!confirm(S.cashoutConfirm)) return;
    try {
      await api.cashout(tableId!, sessionId);
      navigate('/');
    } catch (e: any) {
      alert(e.message);
    }
  }

  // Build ledger: active players + cashed-out players, aggregated by nickname
  const rawLedgerEntries: CashoutLedgerEntry[] = gameState?.cashout_ledger || [];
  const ledgerMap = new Map<string, CashoutLedgerEntry>();
  for (const entry of rawLedgerEntries) {
    const existing = ledgerMap.get(entry.nickname);
    if (existing) {
      existing.total_buyin += entry.total_buyin;
      existing.total_cashout += entry.total_cashout;
      existing.current_stack += entry.current_stack;
    } else {
      ledgerMap.set(entry.nickname, { ...entry });
    }
  }
  const ledgerEntries = Array.from(ledgerMap.values());
  const gameLogs: GameLogEntry[] = gameState?.game_log || [];
  const showLedger = ledgerEntries.length > 0 || gameLogs.length > 0;

  return (
    <div className="table-view">
      <div className="table-top-bar">
        <div className="table-info">
          <span className="table-info-name">{tableConfig?.name || S.tableFallback}</span>
          <span className="table-info-blinds">
            {S.blindsLabel}: {gameState?.blind_small || tableConfig?.blind_small}/{gameState?.blind_big || tableConfig?.blind_big}
          </span>
          {gameState?.round_number ? (
            <span className="table-info-round">{S.roundPrefix}{gameState.round_number}</span>
          ) : null}
        </div>
        <div className="table-actions-top">
          {isAdmin && isWaiting && sortedPlayers.length >= 2 && (
            <button className="btn-primary" onClick={handleStart}>{S.startGame}</button>
          )}
          {tableConfig?.type === 'cash' && (
            <button className="btn-cashout" onClick={handleCashout}>{S.cashoutBtn}</button>
          )}
          <SettingsPanel />
          <HotkeysPanel />
        </div>
      </div>

      <div className="table-area">
        <PokerTable>
          {/* Dealer avatar */}
          <DealerAvatar dealerType={tableConfig?.dealer_type || 'robot'} />

          {/* Pot */}
          <div className="pot-display" aria-live="polite" aria-atomic="true">
            {(gameState?.pot || 0) > 0 && (
              <span className="pot-amount">{S.potDisplay}: {formatChips(gameState?.pot || 0, displayInBB, gameState?.blind_big || 0)}</span>
            )}
          </div>

          {/* Community cards */}
          <CommunityCards cards={gameState?.community_cards || []} />

          {/* Players */}
          {reorderedPlayers.map((p, idx) => (
            <PlayerSeat key={p.player_id} player={p} totalPlayers={reorderedPlayers.length} index={idx} />
          ))}
        </PokerTable>
      </div>

      {/* Game controls (only during player's turn) */}
      <GameControls />

      {/* Modals */}
      <FrolTipModal />
      <ApprovalModal />

      {/* Danilka overlay */}
      {danilkaEvent && <DanilkaOverlay />}

      {/* HotkeysPanel is now in the top bar (desktop only) */}

      {/* Stalling overlay */}
      {stallingAccused && (
        <div className="stalling-overlay">
          <span className="stalling-text">{S.stallingOverlay}</span>
        </div>
      )}

      {/* Cashout ledger */}
      {showLedger && (
        <div className={`cashout-ledger ${ledgerCollapsed ? 'collapsed' : ''}`}>
          <div className="cashout-ledger-title" onClick={() => setLedgerCollapsed(!ledgerCollapsed)}>
            <span>{S.ledger}</span>
            <span className="ledger-toggle">{ledgerCollapsed ? '▲' : '▼'}</span>
          </div>
          {!ledgerCollapsed && (
            <>
              {ledgerEntries.length > 0 && ledgerEntries.map((entry, i) => {
                const delta = (entry.current_stack + entry.total_cashout) - entry.total_buyin;
                return (
                  <div key={i} className="cashout-ledger-row">
                    <span className="ledger-nick">{entry.nickname}</span>
                    <span className="ledger-detail">
                      {S.deposit}: {entry.total_buyin}
                    </span>
                    <span className="ledger-detail">
                      {S.withdrawal}: {entry.total_cashout}
                    </span>
                    <span className={`ledger-delta ${delta >= 0 ? 'positive' : 'negative'}`}>
                      {delta >= 0 ? '+' : ''}{delta}
                    </span>
                  </div>
                );
              })}
              {(gameState?.frol_total_tips ?? 0) > 0 && (
                <div className="cashout-ledger-row frol-tips-row">
                  <span className="ledger-nick">{S.frolTips}</span>
                  <span className="ledger-delta positive">+{gameState!.frol_total_tips}</span>
                </div>
              )}
              {gameLogs.length > 0 && (
                <div className="game-log-section">
                  <div className="game-log-title">{S.gameLogTitle}</div>
                  <div className="game-log-entries">
                    {gameLogs.map((log, i) => (
                      <div key={i} className={`game-log-entry ${log.message.startsWith('---') ? 'log-separator' : ''} ${log.message.startsWith('🏆') ? 'log-winner' : ''}`}>
                        <span className="log-time">{log.time}</span>
                        <span className="log-message">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
