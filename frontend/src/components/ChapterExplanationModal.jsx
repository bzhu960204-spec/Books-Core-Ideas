import { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import LazyRichTextEditor from './LazyRichTextEditor';
import { normalizeReviewContent } from '../utils/reviewContent';
import { isoDay } from '../utils/dates';
import ExplanationHtml from './explanation/ExplanationHtml';
import ExplanationFooter from './explanation/ExplanationFooter';
import PassageMenu from './explanation/PassageMenu';
import MarkPopover from './explanation/MarkPopover';
import { useFloatingMenu } from './explanation/useFloatingMenu';
import { useMarkHover } from './explanation/useMarkHover';
import { highlightsSupported } from '../utils/explanationAnchor';
import { planReanchor } from '../utils/markReanchor';
import { usePassageMarks, useSavedPassageHighlights } from './explanation/usePassageMarks';
import { useReaderPreferences } from './explanation/useReaderPreferences';
import { useReadingPosition } from './explanation/useReadingPosition';
import ChapterImagePanel from './explanation/ChapterImagePanel';
import PanelResizer from './explanation/PanelResizer';

const ORPHAN_LIST_MAX = 5;

// View / edit a single chapter's "explanation" (详解) document. Mirrors the
// review reader: rendered HTML in view mode, RichTextEditor in edit mode, with
// a distraction-free fullscreen toggle. In view mode, selecting text offers to
// save it as a passage; `initialAnchor` scrolls to and flashes a saved passage.
// A chapter with images can show them in a resizable side panel (`chapterId`,
// `imageCount`). The parts live in ./explanation.
export default function ChapterExplanationModal({
  chapterId,
  imageCount = 0,
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
  onUpdateMarkNote,
  onAnchorResult,
  relinkMark = null,
  onRelinkMark,
  onCancelRelink,
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
  const [orphanWarning, setOrphanWarning] = useState(null); // { newlyLost, updates } of a save awaiting a decision
  const bodyRef = useRef(null);
  const splitRef = useRef(null);
  const contentRef = useRef(null);
  const menuRef = useRef(null);

  const passages = usePassageMarks({ editing, contentRef, menuRef, onSaveMark, onDeleteMark, onRelinkMark });
  const prefs = useReaderPreferences();
  const showImagePanel = imageCount > 0 && prefs.imagePanelOpen;

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
  const matches = useSavedPassageHighlights({
    contentRef, editing, showHighlights: prefs.showHighlights, explanation, marks,
  });
  const noticeShowing = !!(passages.savedNotice || passages.removedNotice);
  const hover = useMarkHover({
    contentRef,
    bodyRef,
    matches,
    enabled: !editing && prefs.showHighlights && highlightsSupported() && !passages.selection && !noticeShowing,
  });
  useFloatingMenu({
    menuRef,
    bodyRef,
    editing,
    range: editing
      ? null
      : (passages.selection?.range ?? passages.savedNotice?.range ?? passages.removedNotice?.range ?? null),
  });

  const handleSave = async () => {
    // Saving can make saved passages unfindable: tell the reader first.
    const plan = planReanchor(explanationHtml, normalizeReviewContent(draft), marks);
    if (plan.newlyLost.length) {
      setOrphanWarning(plan);
      return;
    }
    await saveDraft(plan);
  };

  const saveDraft = async (plan) => {
    try {
      await onSave?.(plan.updates.length ? { content: draft, anchorUpdates: plan.updates } : { content: draft });
    } catch {
      return; // reported by the page; keep the draft in the editor
    }
    setEditing(false);
    setFullscreen(false);
  };

  const confirmOrphaning = async () => {
    const plan = orphanWarning;
    setOrphanWarning(null);
    await saveDraft(plan);
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
    ? marks.find(m => !m.orphaned && m.startOffset === selection.anchor.startOffset
      && m.endOffset === selection.anchor.endOffset)
    : null;

  return (
    <Modal
      size="xl"
      className={['review-reader-modal', fullscreen && 'is-fullscreen', showImagePanel && 'has-image-panel']
        .filter(Boolean).join(' ')}
      onClose={onClose}
      title={null}
      closeOnOverlay={!editing}
      closeOnEsc={!editing}
    >
      <header className="review-reader-header">
        <h2 className="review-reader-title">{chapterTitle || 'Chapter'} — Explanation</h2>
        <div className="review-reader-meta">
          {bookTitle && <span className="review-bank-date">{bookTitle}</span>}
          {explanation?.updatedAt && <span className="review-bank-date">{isoDay(explanation.updatedAt)}</span>}
        </div>
        {anchorMissed && (
          <div className="mark-missed-notice" role="status">
            ⚠ The saved passage could not be found — the explanation may have changed. Showing the nearest position.
          </div>
        )}
        {relinkMark && !editing && (
          <div className="mark-missed-notice mark-relink-notice" role="status">
            <span>
              Select the new text for this orphaned passage, then click “Re-link here”:{' '}
              <em>{relinkMark.quote.length > 120 ? `${relinkMark.quote.slice(0, 120).trimEnd()}…` : relinkMark.quote}</em>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancelRelink}>Cancel</button>
          </div>
        )}
      </header>

      <div
        ref={splitRef}
        className="reader-split"
        style={showImagePanel ? { '--image-panel-ratio': prefs.imagePanelRatio } : undefined}
      >
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
        {showImagePanel && (
          <>
            <PanelResizer
              containerRef={splitRef}
              ratio={prefs.imagePanelRatio}
              onChange={prefs.setImagePanelRatio}
            />
            <div className="reader-image-pane">
              <ChapterImagePanel chapterId={chapterId} />
            </div>
          </>
        )}
      </div>

      {!editing && (selection || noticeShowing) && (
        <PassageMenu menuRef={menuRef} passages={passages} duplicate={duplicate} relinkMark={relinkMark} />
      )}

      {!editing && hover.card && (
        <MarkPopover
          popoverRef={hover.popoverRef}
          mark={hover.card.mark}
          pinned={hover.card.pinned}
          editing={hover.card.editing}
          onEditingChange={hover.setEditing}
          onClose={hover.close}
          onUpdateNote={onUpdateMarkNote}
          onRemove={() => passages.remove(hover.card.mark, hover.card.range)}
          onLayout={hover.place}
          onPointerEnter={hover.onPopoverEnter}
          onPointerLeave={hover.onPopoverLeave}
        />
      )}

      <ExplanationFooter
        editing={editing}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen(f => !f)}
        imageCount={imageCount}
        imagePanelOpen={showImagePanel}
        onToggleImagePanel={prefs.toggleImagePanel}
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

      {orphanWarning && (
        <ConfirmDialog
          title="Saved passages will be orphaned"
          message={`This edit removes or changes the text of ${orphanWarning.newlyLost.length} saved ${orphanWarning.newlyLost.length === 1 ? 'passage' : 'passages'}. They are kept (with their notes) but marked Orphaned in Saved Passages, where you can re-link them to new text or delete them.`}
          confirmLabel="Save anyway"
          cancelLabel="Keep editing"
          onConfirm={confirmOrphaning}
          onClose={() => setOrphanWarning(null)}
        >
          <ul className="orphan-warning-list">
            {orphanWarning.newlyLost.slice(0, ORPHAN_LIST_MAX).map(m => (
              <li key={m.id}>{m.quote.length > 90 ? `${m.quote.slice(0, 90).trimEnd()}…` : m.quote}</li>
            ))}
            {orphanWarning.newlyLost.length > ORPHAN_LIST_MAX && (
              <li>…and {orphanWarning.newlyLost.length - ORPHAN_LIST_MAX} more</li>
            )}
          </ul>
        </ConfirmDialog>
      )}

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
