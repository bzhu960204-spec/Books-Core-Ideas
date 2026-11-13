import { useEffect, useRef, useState } from 'react';
import { captureAnchor, findAnchorMatches, highlightsSupported } from '../../utils/explanationAnchor';

/**
 * Saving passages selected in the rendered explanation (`contentRef`): the
 * current selection, its optional note, and the "saved / removed" notices (each
 * with Undo). The
 * selection is captured into state (mouse, keyboard and touch alike) so the
 * action bar in `menuRef` keeps working even after the browser drops the native
 * selection, e.g. when the note input takes focus.
 */
export function usePassageMarks({ editing, contentRef, menuRef, onSaveMark, onDeleteMark, onRelinkMark }) {
  const [selection, setSelection] = useState(null); // { anchor, range }
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingMark, setSavingMark] = useState(false);
  const [savedNotice, setSavedNotice] = useState(null); // { id } of the passage just saved
  const [removedNotice, setRemovedNotice] = useState(null); // { mark, range } of the highlight just removed
  const [markError, setMarkError] = useState('');
  const selectionRef = useRef(null);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  const clearSelection = () => {
    setSelection(null);
    setNoteOpen(false);
    setNoteDraft('');
    setMarkError('');
  };

  // Track the reader's text selection inside the content.
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
      setRemovedNotice(null);
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
  }, [editing, contentRef, menuRef]);

  // Keep the pending passage visibly highlighted even when the native selection
  // is lost, e.g. while typing a note (CSS Custom Highlight API; no DOM changes).
  useEffect(() => {
    if (!highlightsSupported() || !selection) return undefined;
    const highlight = new Highlight(selection.range);
    highlight.priority = 1;
    CSS.highlights.set('mark-pending', highlight);
    return () => CSS.highlights.delete('mark-pending');
  }, [selection]);

  // The notices disappear on their own, or as soon as the reader interacts
  // with anything else.
  const hasNotice = !!(savedNotice || removedNotice);
  useEffect(() => {
    if (!hasNotice) return undefined;
    const dismiss = () => { setSavedNotice(null); setRemovedNotice(null); };
    const timer = setTimeout(dismiss, 6000);
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      dismiss();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [savedNotice, removedNotice, hasNotice, menuRef]);

  const dismissSelection = () => {
    window.getSelection()?.removeAllRanges();
    clearSelection();
  };

  const save = async () => {
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

  // Points an orphaned passage at the current selection.
  const relink = async (markId) => {
    if (!selection || savingMark) return;
    setSavingMark(true);
    setMarkError('');
    try {
      await onRelinkMark?.(markId, selection.anchor);
      dismissSelection();
    } catch {
      setMarkError('Could not re-link. Try again.');
    } finally {
      setSavingMark(false);
    }
  };

  const undo = async () => {
    if (!savedNotice) return;
    const notice = savedNotice;
    setSavedNotice(null);
    try {
      await onDeleteMark?.(notice.id);
    } catch {
      // Bring the notice back: the error is shown in it, and Undo can be retried.
      setSavedNotice(notice);
      setMarkError('Could not undo. Remove it from Saved Passages.');
    }
  };

  // Removes a saved passage (from the hover card or the selection menu) and
  // offers Undo. Rejects when the delete fails so the caller can say so.
  const remove = async (mark, range) => {
    setMarkError('');
    await onDeleteMark?.(mark.id);
    setSavedNotice(null);
    setRemovedNotice({ mark, range });
  };

  // The selection menu's "Remove" for a selection that is exactly a saved passage.
  const removeSelected = async (mark) => {
    if (!selection) return;
    const { range } = selection;
    try {
      await remove(mark, range);
      dismissSelection();
    } catch {
      setMarkError('Could not remove. Try again.');
    }
  };

  // Re-creates the removed passage (same text, position and note; new id).
  const undoRemove = async () => {
    if (!removedNotice) return;
    const { mark } = removedNotice;
    setMarkError('');
    try {
      await onSaveMark?.({
        quote: mark.quote,
        prefix: mark.prefix,
        suffix: mark.suffix,
        startOffset: mark.startOffset,
        endOffset: mark.endOffset,
        note: mark.note ?? '',
      });
      setRemovedNotice(null);
    } catch {
      setMarkError('Could not restore.');
    }
  };

  // Leaving reading mode (Edit) drops the selection and the notices.
  const reset = () => {
    clearSelection();
    setSavedNotice(null);
    setRemovedNotice(null);
  };

  return {
    selection, noteOpen, setNoteOpen, noteDraft, setNoteDraft, savingMark, savedNotice, removedNotice, markError,
    save, undo, remove, removeSelected, undoRemove, relink, reset,
  };
}

const NO_MATCHES = [];

/**
 * Saved passages stay highlighted in the text, like a highlighter pen, unless
 * the reader turned highlights off. Rebuilt whenever the list or the rendered
 * content changes. Returns the located passages as [{ mark, range }].
 */
export function useSavedPassageHighlights({ contentRef, editing, showHighlights, explanation, marks }) {
  const [matches, setMatches] = useState(NO_MATCHES);
  const savedKey = marks.map(m => `${m.id}:${m.startOffset}:${m.endOffset}:${m.note ?? ''}`).join(',');
  useEffect(() => {
    const root = contentRef.current;
    if (editing || !showHighlights || !highlightsSupported() || !root) {
      setMatches(NO_MATCHES);
      return undefined;
    }
    const found = findAnchorMatches(root, marks);
    setMatches(found.length ? found : NO_MATCHES);
    if (!found.length) return undefined;
    CSS.highlights.set('mark-saved', new Highlight(...found.map(m => m.range)));
    return () => CSS.highlights.delete('mark-saved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, showHighlights, explanation, savedKey]);
  return matches;
}
