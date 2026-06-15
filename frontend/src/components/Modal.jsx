import { useEffect } from 'react';

export default function Modal({
  title,
  children,
  onClose,
  size = 'md',
  className = '',
  closeOnOverlay = true,
  closeOnEsc = true,
}) {
  useEffect(() => {
    if (!closeOnEsc) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, closeOnEsc]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="modal-overlay"
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={`modal modal--${size} ${className}`.trim()}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >×</button>
        {title && <h3 className="modal-title">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
