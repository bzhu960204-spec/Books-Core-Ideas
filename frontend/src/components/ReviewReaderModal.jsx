import { useState, useEffect } from 'react';
import Modal from './Modal';
import RichTextEditor, { normalizeReviewContent } from './RichTextEditor';

export default function ReviewReaderModal({
  review,
  startInEdit = false,
  onClose,
  onSave,
  onDelete,
  onOpenBook,
  saving = false,
}) {
  const [editing, setEditing] = useState(startInEdit);
  const [draft, setDraft] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!review) return;
    setDraft(normalizeReviewContent(review.content));
    setDraftTitle(review.title || '');
    setEditing(startInEdit);
  }, [review, startInEdit]);

  // While in fullscreen, intercept Esc so it exits fullscreen first instead
  // of closing the modal entirely.
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

  if (!review) return null;

  const displayTitle = (editing ? draftTitle : review.title)?.trim() || 'Untitled review';

  const handleSave = async () => {
    await onSave?.({ title: draftTitle.trim(), content: draft });
    setEditing(false);
    setFullscreen(false);
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
        {editing ? (
          <input
            type="text"
            className="review-title-input review-reader-title-input"
            placeholder="Review title…"
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            autoFocus
          />
        ) : (
          <h2 className="review-reader-title">{displayTitle}</h2>
        )}
        <div className="review-reader-meta">
          <button type="button" className="review-bank-source-link" onClick={onOpenBook}>
            {review.bookTitle}{review.bookAuthor ? ` · ${review.bookAuthor}` : ''} →
          </button>
          {review.updatedAt && <span className="review-bank-date">{review.updatedAt}</span>}
        </div>
      </header>

      <div className={`review-reader-body ${editing ? 'is-editing' : ''}`}>
        {editing ? (
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            fill
          />
        ) : (
          <div
            className="review-bank-content review-reader-content"
            dangerouslySetInnerHTML={{ __html: normalizeReviewContent(review.content) }}
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
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setFullscreen(false); }} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              🗑️ Delete
            </button>
            <span style={{ flex: 1 }} />
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
