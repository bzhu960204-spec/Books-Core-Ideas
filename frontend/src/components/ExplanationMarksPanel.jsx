import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import MarkItem from './marks/MarkItem';
import PassageFocusDialog from './marks/PassageFocusDialog';
import { useSavedPassagesMaximized } from './marks/useSavedPassagesMaximized';
import { fallbackChapter, marksByChapter } from './marks/marksByChapter';

const sameOrder = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

// Lists the passages saved from this book's explanations: chapters that have
// passages on the left (in book order), the selected chapter's passages on the
// right. Clicking a passage opens a focus dialog to read it with its context
// and write a note; jump / delete are available from both places.
export default function ExplanationMarksPanel({
  marks,
  chapters = [],
  parts = [],
  isParts = false,
  initialChapterId = null,
  onChapterChange,
  staleIds = {},
  onJump,
  onUpdateNote,
  onDelete,
  onClose,
}) {
  const [maximized, setMaximized] = useSavedPassagesMaximized();
  const [focus, setFocus] = useState(null); // { id } | null
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const contentRef = useRef(null);
  const activeChapterRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const groups = useMemo(
    () => marksByChapter(marks, chapters, parts, isParts),
    [marks, chapters, parts, isParts],
  );
  const order = useMemo(() => groups.map(g => g.chapterId), [groups]);

  // `view.order` is the chapter order of the previous render, so a chapter that
  // just lost its last passage can hand over to its neighbour.
  const [view, setView] = useState({ selectedId: initialChapterId, order: [] });
  const selectedId = fallbackChapter(view.order, order, view.selectedId);
  if (selectedId !== view.selectedId || !sameOrder(view.order, order)) {
    setView({ selectedId, order });
  }
  const current = groups.find(g => g.chapterId === selectedId) ?? null;
  const focusOpen = focus != null && !!current?.items.some(m => m.id === focus.id);

  useEffect(() => {
    if (selectedId != null) onChapterChange?.(selectedId);
    if (contentRef.current) contentRef.current.scrollTop = 0;
    activeChapterRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId, onChapterChange]);

  // After the focus dialog closes, bring the last viewed passage into view and flash it.
  useEffect(() => {
    if (focusOpen) return;
    const id = lastFocusedRef.current;
    if (id == null) return;
    lastFocusedRef.current = null;
    const el = contentRef.current?.querySelector(`[data-mark-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView?.({ block: 'nearest' });
    el.classList.remove('mark-flash-block');
    void el.offsetWidth; // restart the animation
    el.classList.add('mark-flash-block');
    setTimeout(() => el.classList.remove('mark-flash-block'), 2200);
  }, [focusOpen]);

  const selectChapter = (chapterId) => {
    if (chapterId === selectedId) return;
    setView(prev => ({ ...prev, selectedId: chapterId }));
    setFocus(null);
    setError('');
  };

  const openFocus = (mark) => {
    lastFocusedRef.current = mark.id;
    setFocus({ id: mark.id });
    setError('');
  };

  const navigateFocus = (id) => {
    lastFocusedRef.current = id;
    setFocus({ id });
  };

  const saveNote = (mark, note) => onUpdateNote(mark.id, note);

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    setError('');
    // Show the next passage of the chapter, else the previous one, else close.
    let nextFocus;
    if (focusOpen && focus.id === target.id) {
      const items = current.items;
      const at = items.findIndex(m => m.id === target.id);
      nextFocus = items[at + 1] ?? items[at - 1] ?? null;
    }
    try {
      if (nextFocus !== undefined) {
        // Switch before the list updates so the dialog doesn't close and reopen.
        lastFocusedRef.current = nextFocus ? nextFocus.id : null;
        setFocus(nextFocus ? { id: nextFocus.id } : null);
      }
      await onDelete(target.id);
    } catch {
      if (nextFocus !== undefined) {
        lastFocusedRef.current = target.id;
        setFocus({ id: target.id });
      }
      setError('Could not delete the passage. Try again.');
    }
  };

  const maximizeButton = (
    <button
      type="button"
      className="modal-icon-btn marks-maximize-btn"
      onClick={() => setMaximized(prev => !prev)}
      aria-label={maximized ? 'Restore' : 'Maximize'}
      title={maximized ? 'Restore size' : 'Maximize'}
    >{maximized ? '⤡' : '⛶'}</button>
  );

  return (
    <>
    <Modal
      size="xl"
      className={`marks-modal${maximized ? ' is-maximized' : ''}`}
      title={`Saved Passages (${marks.length})`}
      onClose={onClose}
      closeOnEsc={!deleteTarget && !focusOpen}
      headerActions={maximizeButton}
    >
      {marks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📑</div>
          <div className="empty-state-text">No saved passages yet.</div>
          <div className="empty-state-hint">Open a chapter explanation and select some text to save it here.</div>
        </div>
      ) : (
        <div className="marks-layout">
          <nav className="marks-sidebar" aria-label="Chapters">
            {groups.map(group => {
              const active = group.chapterId === selectedId;
              const title = group.title || 'Chapter';
              return (
                <button
                  key={group.chapterId}
                  type="button"
                  ref={active ? activeChapterRef : null}
                  className={`marks-chapter-btn${active ? ' is-active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  title={title}
                  onClick={() => selectChapter(group.chapterId)}
                >
                  <span className="marks-chapter-title">{title}</span>
                  <span className="marks-chapter-count">{group.items.length}</span>
                </button>
              );
            })}
          </nav>
          <div className="marks-content" ref={contentRef}>
            {current && (
              <div className="marks-content-inner">
                <div className="marks-content-header">
                  <h4 className="marks-content-title">{current.title || 'Chapter'}</h4>
                  <span className="marks-content-count">
                    {current.items.length} {current.items.length === 1 ? 'passage' : 'passages'}
                  </span>
                </div>
                {error && <div className="marks-error" role="alert">{error}</div>}
                <div className="marks-panel">
                  {current.items.map(mark => (
                    <MarkItem
                      key={mark.id}
                      mark={mark}
                      stale={!!staleIds[mark.id]}
                      onFocus={openFocus}
                      onJump={onJump}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>

    {focusOpen && (
      <PassageFocusDialog
        marks={current.items}
        markId={focus.id}
        chapterTitle={current.title}
        staleIds={staleIds}
        onNavigate={navigateFocus}
        onSaveNote={saveNote}
        onJump={onJump}
        onDelete={setDeleteTarget}
        onClose={() => setFocus(null)}
      />
    )}

    {deleteTarget && (
      <ConfirmDialog
        message="Delete this saved passage? This cannot be undone."
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    )}
    </>
  );
}
