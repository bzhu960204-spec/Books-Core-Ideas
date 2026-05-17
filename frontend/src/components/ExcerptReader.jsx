import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';

/**
 * Full-screen excerpt reader with prev/next navigation.
 *
 * Props:
 *   excerpts     – array of excerpt objects
 *   startIndex   – which excerpt to show first (default 0)
 *   chapterTitle – shown in the header
 *   onClose      – close handler
 *   onEdit(excerpt)  – edit callback
 *   onDelete(excerpt) – delete callback
 */
export default function ExcerptReader({ excerpts, startIndex = 0, chapterTitle, onClose, onEdit, onDelete }) {
  const [idx, setIdx] = useState(startIndex);
  const [showMenu, setShowMenu] = useState(false);

  const ex = excerpts[idx];
  const total = excerpts.length;
  const hasPrev = idx > 0;
  const hasNext = idx < total - 1;

  const goPrev = useCallback(() => { if (hasPrev) setIdx(i => i - 1); }, [hasPrev]);
  const goNext = useCallback(() => { if (hasNext) setIdx(i => i + 1); }, [hasNext]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext]);

  // Reset menu when switching excerpts
  useEffect(() => { setShowMenu(false); }, [idx]);

  if (!ex) return null;

  return createPortal(
    <div className="excerpt-reader-overlay" onClick={onClose}>
      <div className="excerpt-reader" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="excerpt-reader-header">
          <div className="excerpt-reader-title">{chapterTitle}</div>
          <div className="excerpt-reader-meta">
            <span className="excerpt-reader-pos">{idx + 1} / {total}</span>
            <div style={{ position: 'relative' }}>
              <button
                className="btn-icon excerpt-reader-menu-btn"
                onClick={() => setShowMenu(v => !v)}
                title="Actions"
              >⋯</button>
              {showMenu && (
                <div className="excerpt-reader-menu">
                  <button onClick={() => { setShowMenu(false); onEdit(ex); }}>✏️ Edit</button>
                  <button onClick={() => { setShowMenu(false); onDelete(ex); }} className="danger">🗑️ Delete</button>
                </div>
              )}
            </div>
            <button className="btn-icon excerpt-reader-close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* Body – scrollable reading area */}
        <div className="excerpt-reader-body">
          <div className="excerpt-reader-content">
            <ReactMarkdown>{ex.content}</ReactMarkdown>
          </div>

          {ex.note && (
            <div className="excerpt-reader-note">
              <ReactMarkdown>{ex.note}</ReactMarkdown>
            </div>
          )}

          {ex.source && (
            <div className="excerpt-reader-source">— {ex.source}</div>
          )}
        </div>

        {/* Footer nav */}
        <div className="excerpt-reader-nav">
          <button
            className="excerpt-reader-nav-btn"
            onClick={goPrev}
            disabled={!hasPrev}
          >
            ← Prev
          </button>
          <div className="excerpt-reader-dots">
            {total <= 20 && excerpts.map((_, i) => (
              <span
                key={i}
                className={`excerpt-reader-dot${i === idx ? ' active' : ''}`}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
          <button
            className="excerpt-reader-nav-btn"
            onClick={goNext}
            disabled={!hasNext}
          >
            Next →
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
