import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import RichTextEditor, { normalizeReviewContent } from './RichTextEditor';

// Adjustable reading font scale bounds (persisted in localStorage).
const FONT_MIN = 0.85;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;
const FONT_KEY = 'explanationReaderFontScale';

// View / edit a single chapter's "explanation" (详解) document. Mirrors the
// review reader: rendered HTML in view mode, RichTextEditor in edit mode, with
// a distraction-free fullscreen toggle.
export default function ChapterExplanationModal({
  chapterTitle,
  bookTitle,
  explanation,
  startInEdit = false,
  initialScrollRatio = null,
  onClose,
  onSave,
  onDelete,
  onBookmark,
  bookmarking = false,
  saving = false,
}) {
  const hasContent = !!(explanation && explanation.content && explanation.content.trim());
  const [editing, setEditing] = useState(startInEdit || !hasContent);
  const [draft, setDraft] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const bodyRef = useRef(null);
  const [fontScale, setFontScale] = useState(() => {
    const saved = parseFloat(localStorage.getItem(FONT_KEY));
    return Number.isFinite(saved) ? Math.min(FONT_MAX, Math.max(FONT_MIN, saved)) : 1;
  });

  useEffect(() => {
    setDraft(normalizeReviewContent(explanation?.content));
    setEditing(startInEdit || !hasContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explanation, startInEdit]);

  useEffect(() => {
    try { localStorage.setItem(FONT_KEY, String(fontScale)); } catch { /* ignore */ }
  }, [fontScale]);

  const decFont = () => setFontScale(s => Math.max(FONT_MIN, +(s - FONT_STEP).toFixed(2)));
  const incFont = () => setFontScale(s => Math.min(FONT_MAX, +(s + FONT_STEP).toFixed(2)));

  // In fullscreen, Esc exits fullscreen first instead of closing the modal.
  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setFullscreen(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [fullscreen]);

  // Restore the saved reading position when opening/returning to view mode.
  useEffect(() => {
    if (editing || initialScrollRatio == null) return undefined;
    const el = bodyRef.current;
    if (!el) return undefined;
    const id = requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = max > 0 ? initialScrollRatio * max : 0;
    });
    return () => cancelAnimationFrame(id);
  }, [editing, initialScrollRatio, explanation]);

  const handleSave = async () => {
    await onSave?.({ content: draft });
    setEditing(false);
    setFullscreen(false);
  };

  // Record a "read up to here" bookmark at the current scroll position.
  const handleBookmark = async () => {
    const el = bodyRef.current;
    let scrollRatio = 0;
    if (el) {
      const max = el.scrollHeight - el.clientHeight;
      scrollRatio = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
    }
    await onBookmark?.({ scrollRatio });
    setBookmarkSaved(true);
    setTimeout(() => setBookmarkSaved(false), 1800);
  };

  return (
    <Modal
      size="xl"
      className={`review-reader-modal ${fullscreen ? 'is-fullscreen' : ''}`.trim()}
      onClose={onClose}
      title={null}
      closeOnOverlay={!editing}
      closeOnEsc={!editing}
    >
      <header className="review-reader-header">
        <h2 className="review-reader-title">{chapterTitle || 'Chapter'} — Explanation</h2>
        <div className="review-reader-meta">
          {bookTitle && <span className="review-bank-date">{bookTitle}</span>}
          {explanation?.updatedAt && <span className="review-bank-date">{explanation.updatedAt}</span>}
        </div>
      </header>

      <div ref={bodyRef} className={`review-reader-body ${editing ? 'is-editing' : ''}`}>
        {editing ? (
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder="Paste or write the chapter explanation… Markdown paste supported."
            fill
          />
        ) : (
          <div
            className="review-bank-content review-reader-content"
            style={{ '--reader-font-scale': fontScale }}
            dangerouslySetInnerHTML={{ __html: normalizeReviewContent(explanation?.content) }}
          />
        )}
      </div>

      <footer className="review-reader-actions">
        {editing ? (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setFullscreen(f => !f)}
              title={fullscreen ? 'Exit fullscreen (Esc)' : 'Distraction-free editing'}
            >
              {fullscreen ? '⤡ Exit Fullscreen' : '⛶ Fullscreen'}
            </button>
            <span style={{ flex: 1 }} />
            {hasContent && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setEditing(false); setFullscreen(false); }}
                disabled={saving}
              >
                Cancel
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setFullscreen(f => !f)}
              title={fullscreen ? 'Exit fullscreen (Esc)' : 'Distraction-free reading'}
            >
              {fullscreen ? '⤡ Exit Fullscreen' : '⛶ Fullscreen'}
            </button>
            <div className="reader-font-controls" role="group" aria-label="Font size">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={decFont}
                disabled={fontScale <= FONT_MIN}
                title="Smaller text"
                aria-label="Smaller text"
              >
                A−
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={incFont}
                disabled={fontScale >= FONT_MAX}
                title="Larger text"
                aria-label="Larger text"
              >
                A+
              </button>
            </div>
            <span style={{ flex: 1 }} />
            {hasContent && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBookmark}
                disabled={bookmarking}
                title="Save your reading position so you can continue later"
              >
                {bookmarkSaved ? '✓ Saved' : (bookmarking ? 'Saving…' : '🔖 Mark read here')}
              </button>
            )}
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              🗑️ Delete
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
              ✏️ Edit
            </button>
          </>
        )}
      </footer>
    </Modal>
  );
}
