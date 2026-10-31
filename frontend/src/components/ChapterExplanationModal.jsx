import { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import LazyRichTextEditor from './LazyRichTextEditor';
import { normalizeReviewContent } from '../utils/reviewContent';
import ExplanationHtml from './explanation/ExplanationHtml';
import ExplanationFooter from './explanation/ExplanationFooter';
import PassageMenu from './explanation/PassageMenu';
import { useFloatingMenu } from './explanation/useFloatingMenu';
import { usePassageMarks, useSavedPassageHighlights } from './explanation/usePassageMarks';
import { useReaderPreferences } from './explanation/useReaderPreferences';
import { useReadingPosition } from './explanation/useReadingPosition';

// View / edit a single chapter's "explanation" (详解) document. Mirrors the
// review reader: rendered HTML in view mode, RichTextEditor in edit mode, with
// a distraction-free fullscreen toggle. In view mode, selecting text offers to
// save it as a passage; `initialAnchor` scrolls to and flashes a saved passage.
// The parts live in ./explanation.
export default function ChapterExplanationModal({
  chapterTitle,
  bookTitle,
  explanation,
  startInEdit = false,
  initialScrollRatio = null,
  initialAnchor = null,
  onClose,
  onSave,
  onDelete,
  onBookmark,
  onSaveMark,
  onDeleteMark,
  onAnchorResult,
  marks = [],
  bookmarking = false,
  saving = false,
}) {
  const hasContent = !!(explanation && explanation.content && explanation.content.trim());
  const [editing, setEditing] = useState(startInEdit || !hasContent);
  const [draft, setDraft] = useState(() => normalizeReviewContent(explanation?.content));
  // Reset the draft and mode whenever the parent passes a new explanation (e.g.
  // the saved one) or entry mode, adjusting state during render rather than in an effect.
  const [syncedProps, setSyncedProps] = useState({ explanation, startInEdit });
  if (syncedProps.explanation !== explanation || syncedProps.startInEdit !== startInEdit) {
    setSyncedProps({ explanation, startInEdit });
    setDraft(normalizeReviewContent(explanation?.content));
    setEditing(startInEdit || !hasContent);
  }
  const [fullscreen, setFullscreen] = useState(false);
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const bodyRef = useRef(null);
  const contentRef = useRef(null);
  const menuRef = useRef(null);

  const passages = usePassageMarks({ editing, contentRef, menuRef, onSaveMark, onDeleteMark });
  const prefs = useReaderPreferences();

  // Sanitizing a long explanation isn't free; do it once per content change,
  // not on every re-render (e.g. while the reader selects text).
  const explanationHtml = useMemo(
    () => normalizeReviewContent(explanation?.content),
    [explanation?.content],
  );

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

  const anchorMissed = useReadingPosition({
    bodyRef, contentRef, editing, explanation, initialScrollRatio, initialAnchor, onAnchorResult,
  });
  useSavedPassageHighlights({ contentRef, editing, showHighlights: prefs.showHighlights, explanation, marks });
  useFloatingMenu({
    menuRef,
    bodyRef,
    editing,
    range: editing ? null : (passages.selection?.range ?? passages.savedNotice?.range ?? null),
  });

  const handleSave = async () => {
    try {
      await onSave?.({ content: draft });
    } catch {
      return; // reported by the page; keep the draft in the editor
    }
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
    try {
      await onBookmark?.({ scrollRatio });
    } catch {
      return; // reported by the page
    }
    setBookmarkSaved(true);
    setTimeout(() => setBookmarkSaved(false), 1800);
  };

  const { selection } = passages;
  const duplicate = selection
    ? marks.find(m => m.startOffset === selection.anchor.startOffset && m.endOffset === selection.anchor.endOffset)
    : null;

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
        {anchorMissed && (
          <div className="mark-missed-notice" role="status">
            ⚠ The saved passage could not be found — the explanation may have changed. Showing the nearest position.
          </div>
        )}
      </header>

      <div
        ref={bodyRef}
        className={`review-reader-body ${editing ? 'is-editing' : ''}`}
      >
        {editing ? (
          <LazyRichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder="Paste or write the chapter explanation… Markdown paste supported."
            fill
          />
        ) : (
          <ExplanationHtml
            contentRef={contentRef}
            html={explanationHtml}
            fontScale={prefs.fontScale}
          />
        )}
      </div>

      {!editing && (selection || passages.savedNotice) && (
        <PassageMenu menuRef={menuRef} passages={passages} duplicate={duplicate} />
      )}

      <ExplanationFooter
        editing={editing}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen(f => !f)}
        hasContent={hasContent}
        saving={saving}
        onCancelEdit={() => { setEditing(false); setFullscreen(false); }}
        onSave={handleSave}
        prefs={prefs}
        bookmarking={bookmarking}
        bookmarkSaved={bookmarkSaved}
        onBookmark={handleBookmark}
        onDelete={() => setConfirmingDelete(true)}
        onClose={onClose}
        onEdit={() => { passages.reset(); setEditing(true); }}
      />

      {confirmingDelete && (
        <ConfirmDialog
          message={`Delete the explanation of "${chapterTitle || 'this chapter'}"? Its saved passages are deleted too. This cannot be undone.`}
          onConfirm={onDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </Modal>
  );
}
