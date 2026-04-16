import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { S } from '../../strings';
import './Modals.css';

interface Props {
  onClose: () => void;
  onCreated: (tableId: string) => void;
}

interface LobbySettings {
  type: 'cash' | 'tournament';
  blindSmall: number;
  blindBig: number;
  timePerMove: number;
  timeBank: number;
  dealerType: 'robot' | 'frol' | 'danilka';
  minBuyin: number;
  maxBuyin: number;
  startingStack: number;
  blindInterval: number;
  blindMultiplier: number;
}

function loadSavedSettings(): LobbySettings {
  try {
    const raw = localStorage.getItem('lobby_settings');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    type: 'cash', blindSmall: 10, blindBig: 20,
    timePerMove: 30, timeBank: 90, dealerType: 'robot',
    minBuyin: 200, maxBuyin: 2000, startingStack: 1500, blindInterval: 10,
    blindMultiplier: 1.5,
  };
}

function saveSettings(s: LobbySettings) {
  localStorage.setItem('lobby_settings', JSON.stringify(s));
}

export function CreateTableModal({ onClose, onCreated }: Props) {
  const sessionId = useStore((s) => s.sessionId);
  const saved = loadSavedSettings();
  const [name, setName] = useState('');
  const [type, setType] = useState<'cash' | 'tournament'>(saved.type);
  const [blindSmall, setBlindSmall] = useState(saved.blindSmall);
  const [blindBig, setBlindBig] = useState(saved.blindBig);
  const [timePerMove, setTimePerMove] = useState(saved.timePerMove);
  const [timeBank, setTimeBank] = useState(saved.timeBank);
  const [dealerType, setDealerType] = useState<'robot' | 'frol' | 'danilka'>(saved.dealerType);
  const [minBuyin, setMinBuyin] = useState(saved.minBuyin);
  const [maxBuyin, setMaxBuyin] = useState(saved.maxBuyin);
  const [startingStack, setStartingStack] = useState(saved.startingStack);
  const [blindInterval, setBlindInterval] = useState(saved.blindInterval);
  const [blindMultiplier, setBlindMultiplier] = useState(saved.blindMultiplier);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      setError(S.enterTableName);
      return;
    }
    setLoading(true);
    setError('');

    try {
      const clampedTimePerMove = Math.max(5, Math.min(120, timePerMove));
      const clampedTimeBank = Math.max(0, Math.min(600, timeBank));

      const data: any = {
        name: name.trim(),
        type,
        blind_small: blindSmall,
        blind_big: blindBig,
        time_per_move: clampedTimePerMove,
        time_bank: clampedTimeBank,
        dealer_type: dealerType,
      };

      if (type === 'cash') {
        data.min_buyin = minBuyin;
        data.max_buyin = maxBuyin;
      } else {
        data.starting_stack = startingStack;
        data.tournament_blind_interval = blindInterval;
        data.tournament_blind_multiplier = blindMultiplier;
      }

      saveSettings({
        type, blindSmall, blindBig,
        timePerMove: clampedTimePerMove, timeBank: clampedTimeBank,
        dealerType, minBuyin, maxBuyin, startingStack, blindInterval,
        blindMultiplier,
      });

      const res = await api.createTable(data);
      onCreated(res.table_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={S.createTableTitle}
      >
        <h3>{S.createTableTitle}</h3>

        <div className="form-group">
          <label>{S.tableNameLabel}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
        </div>

        <div className="form-group">
          <label>{S.gameTypeLabel}</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="cash">{S.cashGame}</option>
            <option value="tournament">{S.miniTournament}</option>
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{S.smallBlindLabel}</label>
            <input
              type="number"
              min={1}
              value={blindSmall}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 1;
                setBlindSmall(v);
                setBlindBig(v * 2);
              }}
            />
          </div>
          <div className="form-group">
            <label>{S.bigBlindLabel}</label>
            <input
              type="number"
              min={1}
              value={blindBig}
              onChange={(e) => setBlindBig(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{S.timePerMoveLabel}</label>
            <input
              type="number"
              min={10}
              max={60}
              value={timePerMove}
              onChange={(e) => setTimePerMove(parseInt(e.target.value) || 30)}
            />
          </div>
          <div className="form-group">
            <label>{S.timeBankLabel}</label>
            <input
              type="number"
              min={60}
              max={120}
              value={timeBank}
              onChange={(e) => setTimeBank(parseInt(e.target.value) || 90)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>{S.dealerLabel}</label>
          <select value={dealerType} onChange={(e) => setDealerType(e.target.value as any)}>
            <option value="robot">{S.dealerRobot}</option>
            <option value="frol">{S.dealerFrol}</option>
            <option value="danilka">{S.dealerDanilka}</option>
          </select>
        </div>

        {type === 'cash' ? (
          <div className="form-row">
            <div className="form-group">
              <label>{S.minBuyinLabel}</label>
              <input
                type="number"
                min={1}
                value={minBuyin}
                onChange={(e) => setMinBuyin(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>{S.maxBuyinLabel}</label>
              <input
                type="number"
                min={1}
                value={maxBuyin}
                onChange={(e) => setMaxBuyin(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>{S.startingStackLabel}</label>
                <input
                  type="number"
                  min={1}
                  value={startingStack}
                  onChange={(e) => setStartingStack(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="form-group">
                <label>{S.blindIntervalLabel}</label>
                <input
                  type="number"
                  min={1}
                  value={blindInterval}
                  onChange={(e) => setBlindInterval(parseInt(e.target.value) || 10)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>{S.blindMultiplierLabel}</label>
              <select
                value={blindMultiplier}
                onChange={(e) => setBlindMultiplier(parseFloat(e.target.value))}
              >
                <option value={1.25}>×1.25</option>
                <option value={1.5}>×1.5</option>
                <option value={2}>×2</option>
                <option value={2.5}>×2.5</option>
                <option value={3}>×3</option>
              </select>
            </div>
          </>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>{S.cancel}</button>
          <button className="btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? S.creating : S.create}
          </button>
        </div>
      </div>
    </div>
  );
}
