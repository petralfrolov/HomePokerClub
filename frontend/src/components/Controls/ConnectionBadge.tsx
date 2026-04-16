import { useStore } from '../../store/useStore';
import './ConnectionBadge.css';

export function ConnectionBadge() {
  const status = useStore((s) => s.connectionStatus);
  const tableId = useStore((s) => s.tableId);

  // Hide in lobby / idle state — only relevant at the table.
  if (!tableId || status === 'idle') return null;

  const label =
    status === 'online'
      ? 'Онлайн'
      : status === 'connecting'
        ? 'Подключение…'
        : status === 'reconnecting'
          ? 'Переподключение…'
          : 'Нет связи';

  return (
    <div className={`connection-badge connection-${status}`} role="status" aria-live="polite">
      <span className="connection-dot" aria-hidden="true" />
      <span className="connection-label">{label}</span>
    </div>
  );
}
