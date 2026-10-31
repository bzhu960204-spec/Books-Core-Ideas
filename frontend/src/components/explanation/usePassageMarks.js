import { useEffect, useRef, useState } from 'react';
import { captureAnchor, findAnchorRanges, highlightsSupported } from '../../utils/explanationAnchor';

/**
 * Saving passages selected in the rendered explanation (`contentRef`): the
 * current selection, its optional note, and the "saved / undo" notice. The
 * selection is captured into state (mouse, keyboard and touch alike) so the
 * action bar in `menuRef` keeps working even after the browser drops the native
 * selection, e.g. when the note input takes focus.
 */
export function usePassageMarks({ editing, contentRef, menuRef, onSaveMark, onDeleteMark }) {
  const [selection, setSelection] = useState(null); // { anchor, range }
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingMark, setSavingMark] = useState(false);
  const [savedNotice, setSavedNotice] = useState(null); // { id } of the passage just saved
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
  }, [savedNotice, menuRef]);

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

  const undo = async () => {
    if (!savedNotice) return;
    const { id } = savedNotice;
    setSavedNotice(null);
    try {
      await onDeleteMark?.(id);
    } catch {
      setMarkError('Could not undo. Remove it from Saved Passages.');
    }
  };

  // Leaving reading mode (Edit) drops the selection and the notice.
  const reset = () => {
    clearSelection();
    setSavedNotice(null);
  };

  return {
    selection, noteOpen, setNoteOpen, noteDraft, setNoteDraft, savingMark, savedNotice, markError, save, undo, reset,
  };
}

/**
 * Saved passages stay highlighted in the text, like a highlighter pen, unless
 * the reader turned highlights off. Rebuilt whenever the list or the rendered
 * content changes.
 */
export function useSavedPassageHighlights({ contentRef, editing, showHighlights, explanation, marks }) {
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
}
