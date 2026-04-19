import { useStore } from '../../store/useStore';
import { api } from '../../api';
import { S } from '../../strings';
import './Modals.css';

/**
 * Queue-driven approval modal. Shows one pending admin-approval request at a time
 * (rebuy or join). When the admin resolves the current request, the next one in
 * the queue is shown. This prevents concurrent requests from overwriting each
 * other.
 */
export function ApprovalModal() {
  const pendingApprovals = useStore((s) => s.pendingApprovals);
  const removeApproval = useStore((s) => s.removeApproval);
  const sessionId = useStore((s) => s.sessionId);
  const tableId = useStore((s) => s.tableId);
  const tableConfig = useStore((s) => s.tableConfig);
  const gameState = useStore((s) => s.gameState);

  const isAdmin = tableConfig?.admin_session_id === sessionId;
  if (!isAdmin || !tableId || pendingApprovals.length === 0) return null;

  const req = pendingApprovals[0];
  const playerFromState = gameState?.players.find((p) => p.player_id === req.player_id);
  const playerName = req.nickname || playerFromState?.nickname || S.playerFallback;

  const isJoin = req.kind === 'join';
  const title = isJoin ? S.joinRequestTitle : S.rebuyRequestTitle;
  const description = isJoin ? S.wantsJoin : S.wantsRebuy;

  async function handleApprove() {
    try {
      if (isJoin) {
        await api.approveJoin(tableId!, {
          session_id: sessionId,
          target_player_id: req.player_id,
        });
      } else {
        await api.approveRebuy(tableId!, {
          session_id: sessionId,
          target_player_id: req.player_id,
          amount: req.amount,
        });
      }
    } catch (e) {
      console.error(e);
    }
    removeApproval(req.request_id);
  }

  async function handleDeny() {
    try {
      if (isJoin) {
        await api.denyJoin(tableId!, {
          session_id: sessionId,
          target_player_id: req.player_id,
        });
      } else {
        await api.denyRebuy(tableId!, {
          session_id: sessionId,
          target_player_id: req.player_id,
        });
      }
    } catch (e) {
      console.error(e);
    }
    removeApproval(req.request_id);
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3>{title}</h3>
        <p>
          {playerName} {description} <strong>{req.amount}</strong>.
        </p>
        {pendingApprovals.length > 1 && (
          <p className="modal-queue-hint">
            {S.approvalQueue(pendingApprovals.length - 1)}
          </p>
        )}
        <p>{S.allow}</p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={handleDeny}>{S.no}</button>
          <button className="btn-primary" onClick={handleApprove}>{S.yes}</button>
        </div>
      </div>
    </div>
  );
}
