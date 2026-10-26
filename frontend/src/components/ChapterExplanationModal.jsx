import { useState, useEffect, useLayoutEffect, useCallback, useRef, memo } from 'react';
import Modal from './Modal';
import RichTextEditor, { normalizeReviewContent } from './RichTextEditor';
import {
  captureAnchor, findAnchor, findAnchorRanges, flashRange, highlightsSupported, scrollRangeIntoView,
} from '../utils/explanationAnchor';

// Adjustable reading font scale bounds (persisted in localStorage).
const FONT_MIN = 0.85;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;
const FONT_KEY = 'explanationReaderFontScale';
const HIGHLIGHTS_KEY = 'explanationReaderShowHighlights';
const NOTE_MAX = 1000;

// The rendered explanation HTML. Memoized so that unrelated state changes in
// the modal (e.g. the selection action bar appearing) don't re-apply innerHTML,
// which would rebuild the DOM and wipe the reader's current text selection.
const ExplanationHtml = memo(function ExplanationHtml({ html, fontScale, contentRef }) {
  return (
    <div
      ref={contentRef}
      className="review-bank-content review-reader-content"
      style={{ '--reader-font-scale': fontScale }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

// View / edit a single chapter's "explanation" (详解) document. Mirrors the
// review reader: rendered HTML in view mode, RichTextEditor in edit mode, with
// a distraction-free fullscreen toggle. In view mode, selecting text offers to
// save it as a passage; `initialAnchor` scrolls to and flashes a saved passage.
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
  const [draft, setDraft] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const [selection, setSelection] = useState(null); // { anchor, range }
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingMark, setSavingMark] = useState(false);
  const [savedNotice, setSavedNotice] = useState(null); // { id } of the passage just saved
  const [markError, setMarkError] = useState('');
  const [anchorMissed, setAnchorMissed] = useState(false);
  const bodyRef = useRef(null);
  const contentRef = useRef(null);
  const menuRef = useRef(null);
  const selectionRef = useRef(null);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  const [fontScale, setFontScale] = useState(() => {
    const saved = parseFloat(localStorage.getItem(FONT_KEY));
    return Number.isFinite(saved) ? Math.min(FONT_MAX, Math.max(FONT_MIN, saved)) : 1;
  });

  const [showHighlights, setShowHighlights] = useState(() => localStorage.getItem(HIGHLIGHTS_KEY) !== 'off');

  useEffect(() => {
    setDraft(normalizeReviewContent(explanation?.content));
    setEditing(startInEdit || !hasContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explanation, startInEdit]);

  useEffect(() => {
    try { localStorage.setItem(FONT_KEY, String(fontScale)); } catch { /* ignore */ }
  }, [fontScale]);

  useEffect(() => {
    try { localStorage.setItem(HIGHLIGHTS_KEY, showHighlights ? 'on' : 'off'); } catch { /* ignore */ }
  }, [showHighlights]);

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

  // Jump to a saved passage: scroll to it and flash it. If the text can no
  // longer be found, fall back to the saved offset as a scroll ratio.
  useEffect(() => {
    if (editing || !initialAnchor) return undefined;
    const root = contentRef.current;
    const scroller = bodyRef.current;
    if (!root || !scroller) return undefined;
    let stopFlash = null;
    const id = requestAnimationFrame(() => {
      const { range, ratio } = findAnchor(root, initialAnchor);
      if (range) {
        scrollRangeIntoView(scroller, range);
        stopFlash = flashRange(range);
      } else {
        const max = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = max > 0 ? ratio * max : 0;
      }
      setAnchorMissed(!range);
      onAnchorResult?.({ id: initialAnchor.id, exact: !!range });
    });
    return () => {
      cancelAnimationFrame(id);
      stopFlash?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, initialAnchor, explanation]);

  const clearSelection = () => {
    setSelection(null);
    setNoteOpen(false);
    setNoteDraft('');
    setMarkError('');
  };

  // Track the reader's text selection inside the content (mouse, keyboard and
  // touch alike). The selection is captured into state so the action bar keeps
  // working even after the browser drops the native selection, e.g. when the
  // note input takes focus.
  useEffect(() => {
    if (editing) return undefined;
    let timer;
    const evaluate = () => {
      const root = contentRef.current;
      if (!root) return;
      if (menuRef.current?.contains(document.activeElement)) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        clearSelection();
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        clearSelection();
        return;
      }
      const anchor = captureAnchor(root, range);
      if (!anchor) {
        clearSelection();
        return;
      }
      const prev = selectionRef.current;
      if (prev && prev.anchor.startOffset === anchor.startOffset && prev.anchor.endOffset === anchor.endOffset) return;
      setSelection({ anchor, range: range.cloneRange() });
      setSavedNotice(null);
      setNoteOpen(false);
      setNoteDraft('');
      setMarkError('');
    };
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(evaluate, 150);
    };
    document.addEventListener('selectionchange', onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onChange);
    };
  }, [editing]);

  // Keep the pending passage visibly highlighted even when the native selection
  // is lost, e.g. while typing a note (CSS Custom Highlight API; no DOM changes).
  useEffect(() => {
    if (!highlightsSupported() || !selection) return undefined;
    const highlight = new Highlight(selection.range);
    highlight.priority = 1;
    CSS.highlights.set('mark-pending', highlight);
    return () => CSS.highlights.delete('mark-pending');
  }, [selection]);

  // Saved passages stay highlighted in the text, like a highlighter pen, unless
  // the reader turned highlights off. Rebuilt whenever the list or the rendered
  // content changes.
  const savedKey = marks.map(m => `${m.id}:${m.startOffset}:${m.endOffset}`).join(',');
  useEffect(() => {
    if (editing || !showHighlights || !highlightsSupported()) return undefined;
    const root = contentRef.current;
    if (!root) return undefined;
    const ranges = findAnchorRanges(root, marks);
    if (!ranges.length) return undefined;
    CSS.highlights.set('mark-saved', new Highlight(...ranges));
    return () => CSS.highlights.delete('mark-saved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, showHighlights, explanation, savedKey]);

  // The "saved / undo" notice disappears on its own, or as soon as the reader
  // interacts with anything else.
  useEffect(() => {
    if (!savedNotice) return undefined;
    const timer = setTimeout(() => setSavedNotice(null), 6000);
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setSavedNotice(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [savedNotice]);

  const dismissSelection = () => {
    window.getSelection()?.removeAllRanges();
    clearSelection();
  };

  const handleSaveMark = async () => {
    if (!selection || savingMark) return;
    setSavingMark(true);
    setMarkError('');
    try {
      const { range } = selection;
      const saved = await onSaveMark?.({ ...selection.anchor, note: noteDraft.trim() });
      dismissSelection();
      if (saved?.id != null) setSavedNotice({ id: saved.id, range });
    } catch {
      setMarkError('Could not save. Try again.');
    } finally {
      setSavingMark(false);
    }
  };

  const handleUndoSave = async () => {
    if (!savedNotice) return;
    const { id } = savedNotice;
    setSavedNotice(null);
    try {
      await onDeleteMark?.(id);
    } catch {
      setMarkError('Could not undo. Remove it from Saved Passages.');
    }
  };

  // The floating menu hugs the start of the active passage (the selection, or
  // the one just saved), so it stays clear of the browser's own selection menu
  // that appears near the end. Positioned imperatively so it can follow scrolling.
  const menuRangeRef = useRef(null);
  const placeMenu = useCallback(() => {
    const menu = menuRef.current;
    const range = menuRangeRef.current;
    const body = bodyRef.current;
    if (!menu || !range || !body) return;
    const rects = range.getClientRects();
    const first = rects[0] || range.getBoundingClientRect();
    const box = body.getBoundingClientRect();
    let top = first.top - menu.offsetHeight - 8;
    if (top < box.top + 4) top = first.bottom + 8;
    const maxLeft = Math.max(box.left + 8, box.right - menu.offsetWidth - 8);
    const left = Math.min(Math.max(first.left, box.left + 8), maxLeft);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = first.bottom > box.top && first.top < box.bottom ? 'visible' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    menuRangeRef.current = editing ? null : (selection?.range ?? savedNotice?.range ?? null);
    placeMenu();
  });

  useEffect(() => {
    const body = bodyRef.current;
    body?.addEventListener('scroll', placeMenu, { passive: true });
    window.addEventListener('resize', placeMenu);
    return () => {
      body?.removeEventListener('scroll', placeMenu);
      window.removeEventListener('resize', placeMenu);
    };
  }, [placeMenu, editing]);

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
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder="Paste or write the chapter explanation… Markdown paste supported."
            fill
          />
        ) : (
          <ExplanationHtml
            contentRef={contentRef}
            html={normalizeReviewContent(explanation?.content)}
            fontScale={fontScale}
          />
        )}
      </div>

      {!editing && (selection || savedNotice) && (
        <div
          ref={menuRef}
          className="mark-menu"
          role={selection ? 'region' : 'status'}
          aria-label={selection ? 'Save selected passage' : undefined}
          onMouseDown={(e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }}
        >
          {selection ? (
            <>
              {noteOpen && (
                <input
                  type="text"
                  className="form-input mark-menu-input"
                  placeholder="Add a note (optional)"
                  aria-label="Note"
                  maxLength={NOTE_MAX}
                  value={noteDraft}
                  autoFocus
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleSaveMark(); }
                    if (e.key === 'Escape') { e.stopPropagation(); setNoteOpen(false); }
                  }}
                />
              )}
              {duplicate ? (
                <span className="mark-menu-status">✓ Already saved</span>
              ) : (
                <>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveMark} disabled={savingMark}>
                    {savingMark ? 'Saving…' : (noteOpen ? 'Save' : '📑 Save passage')}
                  </button>
                  {!noteOpen && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setNoteOpen(true)}
                      title="Save with a note"
                    >
                      ✎ Note
                    </button>
                  )}
                </>
              )}
              {markError && <span className="mark-menu-error">{markError}</span>}
            </>
          ) : (
            <>
              <span className="mark-menu-status">✓ Passage saved</span>
              <button className="btn btn-secondary btn-sm" onClick={handleUndoSave}>Undo</button>
              {markError && <span className="mark-menu-error">{markError}</span>}
            </>
          )}
        </div>
      )}

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
            {highlightsSupported() && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowHighlights(v => !v)}
                aria-pressed={showHighlights}
                title={showHighlights ? 'Hide highlights of saved passages' : 'Show highlights of saved passages'}
                style={{ marginLeft: '0.35rem' }}
              >
                🖍 Highlights: {showHighlights ? 'On' : 'Off'}
              </button>
            )}
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
            <button className="btn btn-primary btn-sm" onClick={() => { clearSelection(); setSavedNotice(null); setEditing(true); }}>
              ✏️ Edit
            </button>
          </>
        )}
      </footer>
    </Modal>
  );
}
