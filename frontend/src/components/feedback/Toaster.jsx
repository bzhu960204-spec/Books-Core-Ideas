import { useSyncExternalStore } from 'react';
import { dismissToast, getToasts, subscribeToasts } from './toast';

// Renders nothing while there are no toasts, so pages' DOM is unchanged.
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-region">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
          <span className="toast-icon" aria-hidden="true">{t.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span className="toast-message">{t.message}</span>
          <button type="button" className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
