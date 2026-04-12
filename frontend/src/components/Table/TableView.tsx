import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { playSound } from '../../hooks/useSound';
import { api } from '../../api';
import { PokerTable } from './PokerTable';
import { PlayerSeat } from '../Player/PlayerSeat';
import { GameControls } from '../Controls/GameControls';
import { DealerAvatar } from '../Dealer/DealerAvatar';
import { FrolTipModal } from '../Modals/FrolTipModal';
import { RebuyModal } from '../Modals/RebuyModal';
import { DanilkaOverlay } from '../Dealer/DanilkaOverlay';
import { CommunityCards } from './CommunityCards';
import { CashoutLedgerEntry, GameLogEntry } from '../../types';
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
  const [ledgerCollapsed, setLedgerCollapsed] = useState(false);

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

    api.getTable(tableId).then((data) => {
      setTableConfig(data);
    }).catch(() => {
      navigate('/');
    });

    return () => {
      setTableId(null);
      setTableConfig(null);
    };
  }, [tableId]);

  useEffect(() => {
    if (stallingAccused) playSound('stalling');
  }, [stallingAccused]);

  if (!tableId) return null;

  const players = gameState?.players || [];
  const isAdmin = tableConfig?.admin_session_id === sessionId;
  const isWaiting = gameState?.stage === 'waiting' || !gameState?.stage;

  // Reorder players so current user is always at the bottom (last position)
  const myIndex = players.findIndex((p) => p.session_id === sessionId);
  const reorderedPlayers = myIndex >= 0
    ? [...players.slice(myIndex), ...players.slice(0, myIndex)]
    : players;

  async function handleStart() {
    try {
      await api.startGame(tableId!, sessionId);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleCashout() {
    if (!confirm('Вы уверены, что хотите сделать кэшаут и покинуть стол?')) return;
    try {
      await api.cashout(tableId!, sessionId);
      navigate('/');
    } catch (e: any) {
      alert(e.message);
    }
  }

  // Build ledger: active players + cashed-out players
  const ledgerEntries: CashoutLedgerEntry[] = gameState?.cashout_ledger || [];
  const gameLogs: GameLogEntry[] = gameState?.game_log || [];
  const showLedger = ledgerEntries.length > 0 || gameLogs.length > 0;

  return (
    <div className="table-view">
      <div className="table-top-bar">
        <div className="table-info">
          <span className="table-info-name">{tableConfig?.name || 'Стол'}</span>
          <span className="table-info-blinds">
            Блайнды: {gameState?.blind_small || tableConfig?.blind_small}/{gameState?.blind_big || tableConfig?.blind_big}
          </span>
          {gameState?.round_number ? (
            <span className="table-info-round">Раздача #{gameState.round_number}</span>
          ) : null}
        </div>
        <div className="table-actions-top">
          {isAdmin && isWaiting && players.length >= 2 && (
            <button className="btn-primary" onClick={handleStart}>▶ Начать игру</button>
          )}
          {tableConfig?.type === 'cash' && (
            <button className="btn-cashout" onClick={handleCashout}>💰 Кэшаут</button>
          )}
        </div>
      </div>

      <div className="table-area">
        <PokerTable>
          {/* Dealer avatar */}
          <DealerAvatar dealerType={tableConfig?.dealer_type || 'robot'} />

          {/* Pot */}
          <div className="pot-display">
            {(gameState?.pot || 0) > 0 && (
              <span className="pot-amount">Банк: {gameState?.pot}</span>
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
      <RebuyModal />

      {/* Danilka overlay */}
      {danilkaEvent && <DanilkaOverlay />}

      {/* Stalling overlay */}
      {stallingAccused && (
        <div className="stalling-overlay">
          <span className="stalling-text">СТОЛЛИШЬ!</span>
        </div>
      )}

      {/* Cashout ledger */}
      {showLedger && (
        <div className={`cashout-ledger ${ledgerCollapsed ? 'collapsed' : ''}`}>
          <div className="cashout-ledger-title" onClick={() => setLedgerCollapsed(!ledgerCollapsed)}>
            <span>Леджер</span>
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
                      Ввод: {entry.total_buyin}
                    </span>
                    <span className="ledger-detail">
                      Вывод: {entry.total_cashout}
                    </span>
                    <span className={`ledger-delta ${delta >= 0 ? 'positive' : 'negative'}`}>
                      {delta >= 0 ? '+' : ''}{delta}
                    </span>
                  </div>
                );
              })}
              {(gameState?.frol_total_tips ?? 0) > 0 && (
                <div className="cashout-ledger-row frol-tips-row">
                  <span className="ledger-nick">🎩 Фрол (чаевые)</span>
                  <span className="ledger-delta positive">+{gameState!.frol_total_tips}</span>
                </div>
              )}
              {gameLogs.length > 0 && (
                <div className="game-log-section">
                  <div className="game-log-title">Лог игры</div>
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
