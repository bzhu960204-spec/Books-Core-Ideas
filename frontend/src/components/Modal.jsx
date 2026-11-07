import { useEffect } from 'react';

export default function Modal({
  title,
  children,
  onClose,
  size = 'md',
  className = '',
  closeOnOverlay = true,
  closeOnEsc = true,
  headerActions = null,
}) {
  useEffect(() => {
    if (!closeOnEsc) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, closeOnEsc]);

  useEffect(() => {
    const { body } = document;
    // Compensate for the scrollbar width we remove below so background content
    // doesn't shift/widen when the scrollbar disappears.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    if (scrollbarWidth > 0) {
      const currentPad = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPad + scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
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
        <div className="modal-corner">
          {headerActions}
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >×</button>
        </div>
        {title && <h3 className="modal-title">{title}</h3>}
        {size === 'xl' ? children : <div className="modal-body">{children}</div>}
      </div>
    </div>
  );
}
