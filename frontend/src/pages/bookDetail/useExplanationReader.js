import { useEffect, useRef, useState } from 'react';
import { bookmarkApi, explanationApi, markApi } from '../../api';
import { attempt, reportError } from '../../components/feedback/toast';

// State of the explanation reader for a loaded explanation (null = none yet).
function readerState(chapterId, data, startInEdit = false, initialScrollRatio = null, initialAnchor = null) {
  return { chapterId, data: data || { content: '' }, startInEdit: startInEdit || !data, initialScrollRatio, initialAnchor };
}

/**
 * The chapter explanation (详解) reader of the book page: opening a chapter's
 * explanation (also from Reading History via `deepLink`), saving and deleting
 * it, reading bookmarks and saved passages. The explanation text is not cached:
 * it is fetched on open and kept here, so a background refetch can't move the
 * reader back to the top.
 */
export function useExplanationReader({ updateDetail, updateChapter, refresh, deepLink, bookLoaded }) {
  const [modal, setModal] = useState(null); // { chapterId, data, startInEdit, initialScrollRatio, initialAnchor }
  const [saving, setSaving] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [staleMarkIds, setStaleMarkIds] = useState({}); // { markId: true } when a jump could not find the text
  const openedFromState = useRef(false);

  // GET answers 204 (null) for "no explanation yet": then the reader opens as an
  // empty editor. A failed read is reported instead (BUG-18): an empty editor
  // there would look like a missing explanation, and saving it would replace it.
  const open = async (chapterId, startInEdit = false, initialScrollRatio = null, initialAnchor = null) => {
    let data;
    try {
      data = await explanationApi.get(chapterId);
    } catch (err) {
      reportError('Could not open the explanation', err);
      return;
    }
    setModal(readerState(chapterId, data, startInEdit, initialScrollRatio, initialAnchor));
  };

  // Deep-link from Reading History: open an explanation at the saved position.
  useEffect(() => {
    if (openedFromState.current || !bookLoaded || !deepLink?.chapterId) return;
    openedFromState.current = true;
    explanationApi.get(deepLink.chapterId).then(
      data => setModal(readerState(deepLink.chapterId, data, false, deepLink.scrollRatio ?? 0)),
      err => reportError('Could not open the explanation', err),
    );
  }, [bookLoaded, deepLink]);

  // Save and bookmark failures are reported here and rethrown, so the reader
  // stays in edit mode / doesn't show "✓ Saved".
  const save = async ({ content }) => {
    if (!modal) return;
    const chapterId = modal.chapterId;
    setSaving(true);
    try {
      const saved = await explanationApi.save(chapterId, { content });
      updateChapter(chapterId, c => ({ ...c, hasExplanation: true }));
      // Clear startInEdit so the reader switches to view mode after the first save.
      setModal(m => (m ? { ...m, data: saved, startInEdit: false } : m));
      refresh();
    } catch (err) {
      reportError('Could not save the explanation', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!modal) return;
    const chapterId = modal.chapterId;
    if (!await attempt('Could not delete the explanation', () => explanationApi.delete(chapterId))) return;
    updateDetail(d => ({ ...d, marks: d.marks.filter(m => m.chapterId !== chapterId) }));
    updateChapter(chapterId, c => ({ ...c, hasExplanation: false }));
    setModal(null);
    refresh();
  };

  // Record a "read up to here" bookmark for the open chapter's explanation.
  const bookmark = async ({ scrollRatio }) => {
    if (!modal) return;
    const chapterId = modal.chapterId;
    setBookmarking(true);
    try {
      const saved = await bookmarkApi.create(chapterId, { scrollRatio });
      updateDetail(d => ({ ...d, bookmarks: [saved, ...d.bookmarks] }));
      refresh();
    } catch (err) {
      reportError('Could not save the bookmark', err);
      throw err;
    } finally {
      setBookmarking(false);
    }
  };

  // Save a passage selected in the open explanation.
  const saveMark = async (mark) => {
    if (!modal) return null;
    const saved = await markApi.create(modal.chapterId, mark);
    updateDetail(d => ({
      ...d,
      marks: [...d.marks, saved].sort((a, b) =>
        (a.chapterOrderIndex ?? 0) - (b.chapterOrderIndex ?? 0)
        || (a.startOffset ?? 0) - (b.startOffset ?? 0)
        || a.id - b.id),
    }));
    refresh();
    return saved;
  };

  const updateMarkNote = async (markId, note) => {
    const updated = await markApi.updateNote(markId, note);
    updateDetail(d => ({ ...d, marks: d.marks.map(m => (m.id === markId ? updated : m)) }));
    refresh();
  };

  const deleteMark = async (markId) => {
    await markApi.delete(markId);
    updateDetail(d => ({ ...d, marks: d.marks.filter(m => m.id !== markId) }));
    refresh();
  };

  const onAnchorResult = ({ id: markId, exact }) => {
    setStaleMarkIds(prev => {
      if (!!prev[markId] === !exact) return prev;
      const next = { ...prev };
      if (exact) delete next[markId]; else next[markId] = true;
      return next;
    });
  };

  return {
    modal,
    open,
    close: () => setModal(null),
    save,
    saving,
    remove,
    bookmark,
    bookmarking,
    saveMark,
    updateMarkNote,
    deleteMark,
    staleMarkIds,
    onAnchorResult,
  };
}
