import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { S } from '../../strings';
import './Modals.css';

interface Props {
  onClose: () => void;
  onCreated: (tableId: string) => void;
}

export function CreateTableModal({ onClose, onCreated }: Props) {
  const sessionId = useStore((s) => s.sessionId);
  const [name, setName] = useState('');
  const [type, setType] = useState<'cash' | 'tournament'>('cash');
  const [blindSmall, setBlindSmall] = useState(10);
  const [blindBig, setBlindBig] = useState(20);
  const [timePerMove, setTimePerMove] = useState(30);
  const [timeBank, setTimeBank] = useState(90);
  const [dealerType, setDealerType] = useState<'robot' | 'frol' | 'danilka'>('robot');
  const [minBuyin, setMinBuyin] = useState(200);
  const [maxBuyin, setMaxBuyin] = useState(2000);
  const [startingStack, setStartingStack] = useState(1500);
  const [blindInterval, setBlindInterval] = useState(10);
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
      const data: any = {
        name: name.trim(),
        type,
        blind_small: blindSmall,
        blind_big: blindBig,
        time_per_move: timePerMove,
        time_bank: timeBank,
        dealer_type: dealerType,
      };

      if (type === 'cash') {
        data.min_buyin = minBuyin;
        data.max_buyin = maxBuyin;
      } else {
        data.starting_stack = startingStack;
        data.tournament_blind_interval = blindInterval;
      }

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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
