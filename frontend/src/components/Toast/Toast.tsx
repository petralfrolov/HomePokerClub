import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import './Toast.css';

export function ToastStack() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast-${t.kind}`}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            onClick={() => dismiss(t.id)}
          >
            <span className="toast-icon" aria-hidden="true">
              {t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : t.kind === 'warning' ? '⚠' : 'i'}
            </span>
            <span className="toast-message">{t.message}</span>
            <button
              className="toast-close"
              aria-label="Закрыть уведомление"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
