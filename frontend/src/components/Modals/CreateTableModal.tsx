import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
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
      setError('Введите название стола');
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
        <h3>Создать стол</h3>

        <div className="form-group">
          <label>Название стола</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
        </div>

        <div className="form-group">
          <label>Тип игры</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="cash">Кэш-игра</option>
            <option value="tournament">Мини-турнир</option>
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Малый блайнд</label>
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
            <label>Большой блайнд</label>
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
            <label>Время на ход (сек)</label>
            <input
              type="number"
              min={10}
              max={60}
              value={timePerMove}
              onChange={(e) => setTimePerMove(parseInt(e.target.value) || 30)}
            />
          </div>
          <div className="form-group">
            <label>Запас на раздумья (сек)</label>
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
          <label>Дилер</label>
          <select value={dealerType} onChange={(e) => setDealerType(e.target.value as any)}>
            <option value="robot">🤖 Робот</option>
            <option value="frol">😏 Фрол</option>
            <option value="danilka">🃏 Данилка</option>
          </select>
        </div>

        {type === 'cash' ? (
          <div className="form-row">
            <div className="form-group">
              <label>Мин. байин</label>
              <input
                type="number"
                min={1}
                value={minBuyin}
                onChange={(e) => setMinBuyin(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>Макс. байин</label>
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
              <label>Стартовый стек</label>
              <input
                type="number"
                min={1}
                value={startingStack}
                onChange={(e) => setStartingStack(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>Повышение блайндов (раздач)</label>
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
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
