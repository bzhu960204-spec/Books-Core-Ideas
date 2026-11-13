import { useEffect, useRef, useState } from 'react';
import { bookmarkApi, explanationApi, markApi } from '../../api';
import { attempt, reportError } from '../../components/feedback/toast';

// State of the explanation reader for a loaded explanation (null = none yet).
// `relinkMark` is an orphaned passage the reader is picking new text for.
function readerState(chapterId, data, startInEdit = false, initialScrollRatio = null, initialAnchor = null,
  relinkMark = null) {
  return {
    chapterId, data: data || { content: '' }, startInEdit: startInEdit || !data, initialScrollRatio, initialAnchor,
    relinkMark,
  };
}

const byPosition = (a, b) =>
  (a.chapterOrderIndex ?? 0) - (b.chapterOrderIndex ?? 0)
  || (a.startOffset ?? 0) - (b.startOffset ?? 0)
  || a.id - b.id;

/**
 * The chapter explanation (详解) reader of the book page: opening a chapter's
 * explanation (also from Reading History via `deepLink`), saving and deleting
 * it, reading bookmarks and saved passages. The explanation text is not cached:
 * it is fetched on open and kept here, so a background refetch can't move the
 * reader back to the top. `marks` are the book's saved passages.
 */
export function useExplanationReader({ updateDetail, updateChapter, refresh, deepLink, bookLoaded, marks = [] }) {
  const [modal, setModal] = useState(null); // { chapterId, data, startInEdit, initialScrollRatio, initialAnchor, relinkMark }
  const [saving, setSaving] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const openedFromState = useRef(false);

  // GET answers 204 (null) for "no explanation yet": then the reader opens as an
  // empty editor. A failed read is reported instead (BUG-18): an empty editor
  // there would look like a missing explanation, and saving it would replace it.
  const open = async (chapterId, startInEdit = false, initialScrollRatio = null, initialAnchor = null,
    relinkMark = null) => {
    let data;
    try {
      data = await explanationApi.get(chapterId);
    } catch (err) {
      reportError('Could not open the explanation', err);
      return;
    }
    setModal(readerState(chapterId, data, startInEdit, initialScrollRatio, initialAnchor, relinkMark));
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
  // stays in edit mode / doesn't show "✓ Saved". `anchorUpdates` (see
  // planReanchor) bring the chapter's saved passages in line with the new text; they
  // are applied after the text is saved, and a failure there is only reported.
  const save = async ({ content, anchorUpdates = [] }) => {
    if (!modal) return;
    const chapterId = modal.chapterId;
    setSaving(true);
    try {
      const saved = await explanationApi.save(chapterId, { content });
      updateChapter(chapterId, c => ({ ...c, hasExplanation: true }));
      // Clear startInEdit so the reader switches to view mode after the first save.
      setModal(m => (m ? { ...m, data: saved, startInEdit: false } : m));
      if (anchorUpdates.length) await syncAnchors(chapterId, anchorUpdates, 'Saved, but could not update the saved passages');
      refresh();
    } catch (err) {
      reportError('Could not save the explanation', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Replaces the chapter's passages in the page data with the server's answer.
  const applyChapterMarks = (chapterId, chapterMarks) =>
    updateDetail(d => ({
      ...d,
      marks: [...d.marks.filter(m => m.chapterId !== chapterId), ...chapterMarks].sort(byPosition),
    }));

  const syncAnchors = async (chapterId, updates, failureMessage) => {
    try {
      applyChapterMarks(chapterId, await markApi.updateAnchors(chapterId, updates));
      return true;
    } catch (err) {
      reportError(failureMessage, err);
      return false;
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
    updateDetail(d => ({ ...d, marks: [...d.marks, saved].sort(byPosition) }));
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

  // A jump that finds (or misses) the passage corrects its orphaned state, e.g.
  // for passages saved before orphans were tracked. Best effort: nothing is shown.
  const onAnchorResult = ({ id: markId, exact }) => {
    const mark = marks.find(m => m.id === markId);
    if (!mark || mark.orphaned === !exact) return;
    markApi.updateAnchors(mark.chapterId, [{ id: markId, orphaned: !exact }])
      .then(list => { applyChapterMarks(mark.chapterId, list); refresh(); })
      .catch(() => {});
  };

  // Points an orphaned passage at newly selected text, keeping its note.
  const relinkMark = async (markId, anchor) => {
    if (!modal) return;
    const chapterId = modal.chapterId;
    const ok = await syncAnchors(chapterId, [{ id: markId, ...anchor, orphaned: false }],
      'Could not re-link the passage');
    if (!ok) throw new Error('Could not re-link the passage');
    setModal(m => (m ? { ...m, relinkMark: null } : m));
    refresh();
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
    onAnchorResult,
    relinkMark,
    cancelRelink: () => setModal(m => (m ? { ...m, relinkMark: null } : m)),
  };
}
