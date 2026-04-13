import { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { S } from '../../strings';
import './Dealer.css';

interface Props {
  dealerType: 'robot' | 'frol' | 'danilka';
}

const DEALER_TYPES = ['robot', 'frol', 'danilka'] as const;

export function DealerAvatar({ dealerType }: Props) {
  const sessionId = useStore((s) => s.sessionId);
  const tableId = useStore((s) => s.tableId);
  const tableConfig = useStore((s) => s.tableConfig);
  const [showMenu, setShowMenu] = useState(false);
  const menuTimeout = useRef<ReturnType<typeof setTimeout>>();

  const isAdmin = tableConfig?.admin_session_id === sessionId;

  function handleClick() {
    if (!isAdmin) return;
    setShowMenu((v) => !v);
    clearTimeout(menuTimeout.current);
    menuTimeout.current = setTimeout(() => setShowMenu(false), 4000);
  }

  async function handleChangeDealer(newType: string) {
    if (!tableId) return;
    setShowMenu(false);
    try {
      await api.changeDealer(tableId, { session_id: sessionId, dealer_type: newType });
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="dealer-avatar" onClick={handleClick} style={isAdmin ? { cursor: 'pointer' } : undefined}>
      <img
        src={`/static/dealer_avatars/${dealerType}.png`}
        alt={S.dealerNames[dealerType]}
        className="dealer-img"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <span className="dealer-name">{S.dealerNames[dealerType]}</span>

      {showMenu && isAdmin && (
        <div className="dealer-context-menu">
          {DEALER_TYPES.filter((t) => t !== dealerType).map((t) => (
            <button
              key={t}
              className="dealer-menu-item"
              onClick={(e) => { e.stopPropagation(); handleChangeDealer(t); }}
            >
              {S.dealerNames[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
