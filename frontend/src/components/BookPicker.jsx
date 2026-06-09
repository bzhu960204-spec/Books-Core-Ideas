import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function BookPickerModal({ books, selectedId, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  const filtered = books.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    (b.author || '').toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="book-picker-overlay" onClick={onClose}>
      <div className="book-picker-panel" onClick={e => e.stopPropagation()}>
        <div className="book-picker-header">
          <span className="book-picker-title">Select a Book</span>
          <button type="button" onClick={onClose} className="book-picker-close">&times;</button>
        </div>
        <div className="book-picker-search">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or author..."
            className="form-input"
          />
        </div>
        <div className="book-picker-list">
          <button
            type="button"
            onClick={() => { onSelect(''); onClose(); }}
            className={`book-picker-item ${!selectedId ? 'active' : ''}`}
          >
            All Books
          </button>
          {filtered.length === 0 && (
            <div className="book-picker-empty">No books found</div>
          )}
          {filtered.map(b => (
            <button
              key={b.id}
              type="button"
              onClick={() => { onSelect(b.id); onClose(); }}
              className={`book-picker-item ${String(b.id) === String(selectedId) ? 'active' : ''}`}
            >
              {b.title}
              {b.author && <span className="book-picker-item-author">{b.author}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function BookPicker({ books, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const selected = books.find(b => String(b.id) === String(selectedId));

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`book-picker-trigger ${selected ? 'has-selection' : ''}`}
      >
        <span className="book-picker-trigger-text">
          {selected ? selected.title : 'All Books'}
        </span>
        {selected && (
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(''); }}
            className="book-picker-trigger-clear"
          >&times;</span>
        )}
        <span className="book-picker-trigger-icon">&#128269;</span>
      </button>

      {open && (
        <BookPickerModal
          books={books}
          selectedId={selectedId}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
