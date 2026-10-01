import { useState, useRef, useEffect } from 'react';

const STATUS_OPTIONS = [
  { value: 'WANT_TO_READ', label: '📋 Want to Read', cls: 'want-to-read' },
  { value: 'READING', label: '📖 Reading', cls: 'reading' },
  { value: 'FINISHED', label: '✅ Finished', cls: 'finished' },
];

export function statusMeta(status) {
  return STATUS_OPTIONS.find(o => o.value === status) || null;
}

export default function ReadingStatusControl({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = statusMeta(status);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const select = (value) => {
    setOpen(false);
    if (value !== status) onChange(value);
  };

  return (
    <div className="reading-status-control" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className={`reading-status-badge editable ${current ? current.cls : 'unset'}`}
        onClick={() => setOpen(o => !o)}
        title="Change reading status"
      >
        {current ? current.label : '➕ Set status'}
        <span className="reading-status-caret">▾</span>
      </button>
      {open && (
        <div className="reading-status-menu" role="menu">
          {STATUS_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              className={`reading-status-menu-item ${status === o.value ? 'active' : ''}`}
              onClick={() => select(o.value)}
            >
              {o.label}
            </button>
          ))}
          {current && (
            <button
              type="button"
              className="reading-status-menu-item clear"
              onClick={() => select('')}
            >
              ✕ Clear status
            </button>
          )}
        </div>
      )}
    </div>
  );
}
