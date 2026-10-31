import { useEffect, useState } from 'react';
import Modal from './Modal';

/**
 * The app's one confirmation dialog (FE-05; no window.confirm). While `onConfirm`
 * runs, both buttons are disabled, so a slow delete can't be sent twice. The
 * caller closes the dialog when its action succeeds; on failure it reports the
 * error and the dialog stays open for another try.
 */
export default function ConfirmDialog({ title = 'Confirm', message, confirmLabel = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);

  // Esc closes only this dialog, not the reader or panel it was opened from.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose?.();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} closeOnEsc={false}>
      <p className="confirm-text">{message}</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" onClick={confirm} disabled={busy}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
