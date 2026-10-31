import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useQueryClient } from '@tanstack/react-query';
import { bookApi, chapterApi, partApi, ideaApi, excerptApi, explanationApi, bookmarkApi, markApi, importApi } from '../api';
import { queryKeys, useBookDetail, useRefresh } from '../queries';
import { chapterContentImport, groupedContentImport, structureImport } from '../utils/jsonImport';
import ChapterForm from '../components/ChapterForm';
import PartForm from '../components/PartForm';
import IdeaForm from '../components/IdeaForm';
import ExcerptForm from '../components/ExcerptForm';
import ExcerptReader from '../components/ExcerptReader';
import ChapterImageViewer from '../components/ChapterImageViewer';
import ConfirmDialog from '../components/ConfirmDialog';
import JsonImportModal from '../components/JsonImportModal';
import ChapterExplanationModal from '../components/ChapterExplanationModal';
import ExplanationMarksPanel from '../components/ExplanationMarksPanel';
import ExplanationExportModal from '../components/ExplanationExportModal';
import ReadingStatusControl from '../components/ReadingStatusControl';

const CHAPTERS_JSON_HINT = `// Array of chapters (keyIdeas & excerpts optional):
[
  {
    "title": "Chapter 1: The Beginning",
    "orderIndex": 1,
    "summary": "Overview of the chapter...",
    "keyIdeas": [
      { "content": "Core insight here", "example": "For instance...", "orderIndex": 1 }
    ],
    "excerpts": [
      { "content": "A memorable passage...", "note": "Why it matters", "orderIndex": 1 }
    ]
  },
  {
    "title": "Chapter 2: Going Deeper",
    "orderIndex": 2,
    "summary": "..."
  }
]`;

const PARTS_JSON_HINT = `// Array of parts. "chapters" is OPTIONAL — import bare
// part shells (title/orderIndex/summary) with "Add New", then drag your
// existing chapters into them. Or nest chapters to create them too:
[
  {
    "title": "Part I: Foundations",
    "orderIndex": 1,
    "summary": "Overview of part one (optional)"
  },
  {
    "title": "Part II: Application",
    "orderIndex": 2,
    "summary": "...",
    "chapters": [
      {
        "title": "Chapter 1: The Beginning",
        "orderIndex": 1,
        "summary": "...",
        "keyIdeas": [
          { "content": "Core insight", "example": "...", "orderIndex": 1 }
        ],
        "excerpts": [
          { "content": "A memorable passage...", "note": "Why it matters", "orderIndex": 1 }
        ]
      }
    ]
  }
]`;

const IDEAS_JSON_HINT = `// Group ideas by chapter title:
[
  {
    "chapter": "Chapter 1: The Beginning",
    "ideas": [
      { "content": "Core insight", "example": "For instance...", "orderIndex": 1 },
      { "content": "Another idea", "orderIndex": 2 }
    ]
  },
  {
    "chapter": "Chapter 2: Going Deeper",
    "ideas": [
      { "content": "Key concept", "orderIndex": 1 }
    ]
  }
]`;

const EXCERPTS_JSON_HINT = `// Group excerpts by chapter title:
[
  {
    "chapter": "Chapter 1: The Beginning",
    "excerpts": [
      {
        "content": "The full passage text. **Markdown** supported.",
        "note": "Why this stands out (optional)",
        "source": "p.42 (optional)",
        "orderIndex": 1
      }
    ]
  },
  {
    "chapter": "Chapter 2: Going Deeper",
    "excerpts": [
      { "content": "Another memorable passage...", "orderIndex": 1 }
    ]
  }
]`;

const CHAPTER_IDEAS_HINT = `// Array of ideas for this chapter:
[
  { "content": "Core insight", "example": "For instance...", "orderIndex": 1 },
  { "content": "Another idea", "orderIndex": 2 }
]`;

const CHAPTER_EXCERPTS_HINT = `// Array of excerpts for this chapter:
[
  {
    "content": "The full passage. **Markdown** supported.",
    "note": "Why it stands out (optional)",
    "source": "p.42 (optional)",
    "orderIndex": 1
  },
  { "content": "Another memorable passage...", "orderIndex": 2 }
]`;

const CHAPTER_COMBINED_HINT = `// Import ideas AND excerpts together:
{
  "ideas": [
    { "content": "Core insight", "example": "For instance...", "orderIndex": 1 },
    { "content": "Another idea", "orderIndex": 2 }
  ],
  "excerpts": [
    {
      "content": "A memorable passage. **Markdown** supported.",
      "note": "Why it stands out (optional)",
      "source": "p.42 (optional)",
      "orderIndex": 1
    }
  ]
}`;

// Compact "May 3, 2:14 PM" style timestamp for reading bookmarks.
function formatBookmarkTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const NONE = [];

// State of the explanation reader for a loaded explanation (null = none yet).
function explanationModalState(chapterId, data, startInEdit = false, initialScrollRatio = null, initialAnchor = null) {
  return { chapterId, data: data || { content: '' }, startInEdit: startInEdit || !data, initialScrollRatio, initialAnchor };
}

const byChapterId = (chapters, value) => Object.fromEntries(chapters.map(c => [c.id, value(c)]));

export default function BookDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  const fromCollections = location.state?.from === 'collections';
  const backTo = fromCollections ? '/collections' : '/';
  const backState = fromCollections
    ? { collectionId: location.state?.collectionId ?? null, includeDescendants: location.state?.includeDescendants ?? false }
    : undefined;
  const backLabel = fromCollections ? '← Back to Collection' : '← Back to Library';

  // Everything the page shows comes from one cached request (GET /books/{id}/detail).
  const detailQuery = useBookDetail(id);
  const detail = detailQuery.data;
  const book = detail?.book ?? null;
  const chapters = detail?.chapters ?? NONE;
  const parts = book?.structureType === 'PARTS' ? detail.parts : NONE;
  const marks = detail?.marks ?? NONE; // saved explanation passages for this book
  const bookmarks = detail?.bookmarks ?? NONE; // newest first
  const latestBookmark = bookmarks[0] ?? null; // drives "continue reading"
  const bookmarkedChapterIds = Object.fromEntries(bookmarks.map(m => [m.chapterId, true]));
  const chapterIdeas = byChapterId(chapters, c => c.keyIdeas);
  const chapterExcerpts = byChapterId(chapters, c => c.excerpts);
  const chapterImageCounts = byChapterId(chapters, c => c.imageCount);
  const chapterHasExplanation = byChapterId(chapters, c => c.hasExplanation);
  // Immediate feedback after a write; refresh() then confirms it from the server.
  const updateDetail = (change) =>
    queryClient.setQueryData(queryKeys.bookDetail(id), d => (d ? change(d) : d));
  const updateChapter = (chapterId, change) =>
    updateDetail(d => ({ ...d, chapters: d.chapters.map(c => (c.id === chapterId ? change(c) : c)) }));

  const [collapsedParts, setCollapsedParts] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [scrollToChapter, setScrollToChapter] = useState(null);
  const chapterRefs = useRef({});
  const openedFromState = useRef(false);

  // Form states
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editChapter, setEditChapter] = useState(null);
  const [addChapterPartId, setAddChapterPartId] = useState(null); // part to add the new chapter to
  const [showPartForm, setShowPartForm] = useState(false);
  const [editPart, setEditPart] = useState(null);
  const [showIdeaForm, setShowIdeaForm] = useState(null); // chapterId
  const [editIdea, setEditIdea] = useState(null);
  const [showExcerptForm, setShowExcerptForm] = useState(null); // chapterId
  const [editExcerpt, setEditExcerpt] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type, id, chapterId?, name }
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [showChapterImport, setShowChapterImport] = useState(null); // chapterId
  const [excerptReader, setExcerptReader] = useState(null); // { chapterId, startIndex }
  const [imageViewer, setImageViewer] = useState(null); // chapterId
  const [explanationModal, setExplanationModal] = useState(null); // { chapterId, data, startInEdit, initialScrollRatio, initialAnchor }
  const [savingExplanation, setSavingExplanation] = useState(false);
  const [showMarks, setShowMarks] = useState(false);
  const [staleMarkIds, setStaleMarkIds] = useState({}); // { markId: true } when a jump could not find the text
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [showExplanationExport, setShowExplanationExport] = useState(false);
  // Drag-and-drop: reassign a chapter to another part (or to "Ungrouped").
  const [draggedChapterId, setDraggedChapterId] = useState(null);
  const [dragOverPartId, setDragOverPartId] = useState(null); // part id, 'ungrouped', or null

  const handleStatusChange = async (status) => {
    const newStatus = status || null;
    updateDetail(d => ({ ...d, book: { ...d.book, readingStatus: newStatus } }));
    try {
      await bookApi.update(book.id, { ...book, readingStatus: newStatus });
    } catch { /* refresh() puts the stored status back */ }
    refresh();
  };

  const handleExport = async () => {
    try {
      const data = await bookApi.export(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book?.title || 'book'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (scrollToChapter && chapterRefs.current[scrollToChapter]) {
      chapterRefs.current[scrollToChapter].scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToChapter(null);
    }
  }, [scrollToChapter, expandedChapters]);

  // While dragging a chapter, auto-scroll the window when the pointer nears the
  // top/bottom edge so parts above/below the fold stay reachable as drop targets.
  useEffect(() => {
    if (draggedChapterId == null) return;
    const EDGE = 90;       // distance from edge (px) that triggers scrolling
    const MAX_SPEED = 20;  // max scroll step (px) per frame at the very edge
    let pointerY = null;
    let rafId = null;

    const onDragOver = e => { pointerY = e.clientY; };

    const step = () => {
      if (pointerY != null) {
        const vh = window.innerHeight;
        if (pointerY < EDGE) {
          window.scrollBy(0, -MAX_SPEED * ((EDGE - pointerY) / EDGE));
        } else if (pointerY > vh - EDGE) {
          window.scrollBy(0, MAX_SPEED * ((pointerY - (vh - EDGE)) / EDGE));
        }
      }
      rafId = requestAnimationFrame(step);
    };

    window.addEventListener('dragover', onDragOver);
    rafId = requestAnimationFrame(step);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [draggedChapterId]);

  // Ideas and excerpts come with the chapters, so expanding needs no request.
  const toggleChapter = (chapterId) => {
    const isExpanded = expandedChapters[chapterId];
    setExpandedChapters(isExpanded ? {} : { [chapterId]: true });
    if (!isExpanded) setScrollToChapter(chapterId);
  };

  // Chapter explanation (详解) — open loads the document, then view/edit inline.
  const openExplanation = async (chapterId, startInEdit = false, initialScrollRatio = null, initialAnchor = null) => {
    let data = null;
    try {
      data = await explanationApi.get(chapterId);
    } catch { /* none yet */ }
    setExplanationModal(explanationModalState(chapterId, data, startInEdit, initialScrollRatio, initialAnchor));
  };

  // Save a passage selected in the open explanation.
  const handleSaveMark = async (mark) => {
    if (!explanationModal) return null;
    const saved = await markApi.create(explanationModal.chapterId, mark);
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

  const handleUpdateMarkNote = async (markId, note) => {
    const updated = await markApi.updateNote(markId, note);
    updateDetail(d => ({ ...d, marks: d.marks.map(m => (m.id === markId ? updated : m)) }));
    refresh();
  };

  const handleDeleteMark = async (markId) => {
    await markApi.delete(markId);
    updateDetail(d => ({ ...d, marks: d.marks.filter(m => m.id !== markId) }));
    refresh();
  };

  const jumpToMark = (mark) => {
    setShowMarks(false);
    openExplanation(mark.chapterId, false, null, mark);
  };

  const handleAnchorResult = ({ id: markId, exact }) => {
    setStaleMarkIds(prev => {
      if (!!prev[markId] === !exact) return prev;
      const next = { ...prev };
      if (exact) delete next[markId]; else next[markId] = true;
      return next;
    });
  };

  // Jump straight to the most recently bookmarked chapter and scroll position.
  const continueReading = () => {
    if (!latestBookmark) return;
    openExplanation(latestBookmark.chapterId, false, latestBookmark.scrollRatio ?? 0);
  };

  // Record a "read up to here" bookmark for the open chapter's explanation.
  const handleBookmark = async ({ scrollRatio }) => {
    if (!explanationModal) return;
    const chapterId = explanationModal.chapterId;
    setSavingBookmark(true);
    try {
      const saved = await bookmarkApi.create(chapterId, { scrollRatio });
      updateDetail(d => ({ ...d, bookmarks: [saved, ...d.bookmarks] }));
      refresh();
    } finally {
      setSavingBookmark(false);
    }
  };

  // Deep-link from Reading History: open an explanation at the saved position.
  const deepLink = location.state?.openExplanation;
  const bookLoaded = book != null;
  useEffect(() => {
    if (openedFromState.current || !bookLoaded || !deepLink?.chapterId) return;
    openedFromState.current = true;
    explanationApi.get(deepLink.chapterId)
      .catch(() => null)
      .then(data => setExplanationModal(explanationModalState(deepLink.chapterId, data, false, deepLink.scrollRatio ?? 0)));
  }, [bookLoaded, deepLink]);

  const handleSaveExplanation = async ({ content }) => {
    if (!explanationModal) return;
    const chapterId = explanationModal.chapterId;
    setSavingExplanation(true);
    try {
      const saved = await explanationApi.save(chapterId, { content });
      updateChapter(chapterId, c => ({ ...c, hasExplanation: true }));
      // Clear startInEdit so the reader switches to view mode after the first save.
      setExplanationModal(m => (m ? { ...m, data: saved, startInEdit: false } : m));
      refresh();
    } finally {
      setSavingExplanation(false);
    }
  };

  const handleDeleteExplanation = async () => {
    if (!explanationModal) return;
    const chapterId = explanationModal.chapterId;
    await explanationApi.delete(chapterId);
    updateDetail(d => ({ ...d, marks: d.marks.filter(m => m.chapterId !== chapterId) }));
    updateChapter(chapterId, c => ({ ...c, hasExplanation: false }));
    setExplanationModal(null);
    refresh();
  };

  // Chapter CRUD
  const handleSaveChapter = async (form) => {
    if (editChapter) {
      await chapterApi.update(id, editChapter.id, { ...form, partId: editChapter.partId ?? null });
    } else {
      await chapterApi.create(id, { ...form, partId: addChapterPartId ?? null });
    }
    setShowChapterForm(false);
    setEditChapter(null);
    setAddChapterPartId(null);
    refresh();
  };

  // Part CRUD
  const handleSavePart = async (form) => {
    if (editPart) {
      await partApi.update(id, editPart.id, form);
    } else {
      await partApi.create(id, form);
    }
    setShowPartForm(false);
    setEditPart(null);
    refresh();
  };

  // Idea CRUD
  const handleSaveIdea = async (form) => {
    const chapterId = editIdea ? editIdea.chapterId : showIdeaForm;
    if (editIdea) {
      await ideaApi.update(chapterId, editIdea.id, form);
    } else {
      await ideaApi.create(chapterId, form);
    }
    setShowIdeaForm(null);
    setEditIdea(null);
    refresh();
  };

  const handleToggleHighlight = async (idea, chapterId) => {
    await ideaApi.update(chapterId, idea.id, { ...idea, highlighted: !idea.highlighted });
    refresh();
  };

  const handleToggleExcerptHighlight = async (excerpt) => {
    await excerptApi.update(excerpt.chapterId || excerptReader?.chapterId, excerpt.id, { ...excerpt, highlighted: !excerpt.highlighted });
    refresh();
  };

  // Excerpt CRUD
  const handleSaveExcerpt = async (form) => {
    const chapterId = editExcerpt ? editExcerpt.chapterId : showExcerptForm;
    if (editExcerpt) {
      await excerptApi.update(chapterId, editExcerpt.id, form);
    } else {
      await excerptApi.create(chapterId, form);
    }
    setShowExcerptForm(null);
    setEditExcerpt(null);
    refresh();
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'chapter') {
      await chapterApi.delete(id, deleteTarget.id);
    } else if (deleteTarget.type === 'part') {
      await partApi.delete(id, deleteTarget.id);
    } else if (deleteTarget.type === 'idea') {
      await ideaApi.delete(deleteTarget.chapterId, deleteTarget.id);
    } else if (deleteTarget.type === 'excerpt') {
      await excerptApi.delete(deleteTarget.chapterId, deleteTarget.id);
      const remaining = (chapterExcerpts[deleteTarget.chapterId] ?? []).filter(e => e.id !== deleteTarget.id);
      updateChapter(deleteTarget.chapterId, c => ({ ...c, excerpts: remaining }));
      if (remaining.length > 0) {
        const newIndex = Math.min(deleteTarget.readerIndex ?? 0, remaining.length - 1);
        setExcerptReader({ chapterId: deleteTarget.chapterId, startIndex: newIndex });
      }
    }
    setDeleteTarget(null);
    refresh();
  };

  // JSON import (FE-08): one server-side transaction per import; bodies from utils/jsonImport.
  const handleStructureImport = async (parsed, mode) => {
    await importApi.structure(id, structureImport(parsed, mode, book.structureType === 'PARTS'));
    await refresh();
  };

  const handleGroupedImport = (kind) => async (parsed, mode) => {
    await importApi.content(id, groupedContentImport(parsed, mode, kind));
    await refresh();
  };

  const handleChapterImport = (chapterId, kind) => async (parsed, mode) => {
    await importApi.content(id, chapterContentImport(parsed, mode, chapterId, kind));
    await refresh();
  };

  if (detailQuery.isPending) return <div className="loading">Loading book</div>;
  if (!book) return <div className="empty-state"><p>Book not found</p></div>;

  const isParts = book.structureType === 'PARTS';

  const togglePart = (partId) => {
    setCollapsedParts(prev => ({ ...prev, [partId]: !prev[partId] }));
  };

  // Move a chapter to another part (targetPartId = null → "Ungrouped"). Only the
  // chapter's part_id changes, so its ideas/excerpts/explanation stay attached.
  const handleChapterReassign = async (chapterId, targetPartId) => {
    if (chapterId == null) return;
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    const currentPartId = chapter.partId ?? null;
    const newPartId = targetPartId ?? null;
    if (currentPartId === newPartId) return;
    updateChapter(chapterId, c => ({ ...c, partId: newPartId }));
    try {
      await chapterApi.update(id, chapterId, {
        title: chapter.title,
        orderIndex: chapter.orderIndex,
        summary: chapter.summary,
        partId: newPartId,
      });
    } catch {
      updateChapter(chapterId, c => ({ ...c, partId: currentPartId }));
    }
    refresh();
  };

  // Build the export list for explanations: assign a book-wide continuous sequence
  // number (in reading order) plus the owning part's number, so exported file names
  // sort into reading order.
  const buildExplanationExportChapters = () => {
    let ordered;
    if (isParts) {
      const sortedParts = [...parts].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      ordered = [];
      sortedParts.forEach((part, pIdx) => {
        chapters
          .filter(c => c.partId === part.id)
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          .forEach(c => ordered.push({ chapter: c, partOrder: part.orderIndex || pIdx + 1, partTitle: part.title }));
      });
      const partIds = new Set(sortedParts.map(p => p.id));
      chapters
        .filter(c => !partIds.has(c.partId))
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .forEach(c => ordered.push({ chapter: c, partOrder: null, partTitle: null }));
    } else {
      ordered = [...chapters]
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .map(c => ({ chapter: c, partOrder: null, partTitle: null }));
    }
    return ordered
      .map((o, idx) => ({ id: o.chapter.id, title: o.chapter.title, seq: idx + 1, partOrder: o.partOrder, partTitle: o.partTitle }))
      .filter(o => chapterHasExplanation[o.id]);
  };

  const renderChapter = (chapter, idx) => (
    <div key={chapter.id} className="chapter-item" ref={el => chapterRefs.current[chapter.id] = el}>
      <div className="chapter-header" onClick={() => toggleChapter(chapter.id)}>
        <div className="chapter-header-left">
          {isParts && (
            <span
              className="chapter-drag-handle"
              draggable
              onClick={e => e.stopPropagation()}
              onDragStart={e => { e.stopPropagation(); setDraggedChapterId(chapter.id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => { setDraggedChapterId(null); setDragOverPartId(null); }}
              title="Drag to move this chapter to another part"
            >⠿</span>
          )}
          <span className="chapter-number">{chapter.orderIndex || idx + 1}</span>
          <div>
            <div className="chapter-title">{chapter.title}</div>
            {chapter.summary && <div className="chapter-summary"><ReactMarkdown>{chapter.summary}</ReactMarkdown></div>}
          </div>
        </div>
        <div className="chapter-actions" onClick={e => e.stopPropagation()}>
          <button
            className="btn-icon"
            title="Import JSON for this chapter"
            onClick={() => setShowChapterImport(chapter.id)}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '-0.05em' }}
          >{'{}'}</button>
          {book.chapterImagesEnabled && (
            <button
              className="btn-icon image-badge"
              title="Chapter images"
              onClick={() => setImageViewer(chapter.id)}
            >🖼️{chapterImageCounts[chapter.id] > 0 ? ` ${chapterImageCounts[chapter.id]}` : ''}</button>
          )}
          {chapterExcerpts[chapter.id] && chapterExcerpts[chapter.id].length > 0 && (
            <button
              className="btn-icon excerpt-badge"
              title="Read excerpts"
              onClick={() => setExcerptReader({ chapterId: chapter.id, startIndex: 0 })}
            >📖 {chapterExcerpts[chapter.id].length}</button>
          )}
          <button
            className="btn-icon"
            title={chapterHasExplanation[chapter.id] ? 'View / edit explanation' : 'Add explanation'}
            onClick={() => openExplanation(chapter.id)}
            style={{ opacity: chapterHasExplanation[chapter.id] ? 1 : 0.5 }}
          >📄{chapterHasExplanation[chapter.id] ? '✓' : ''}</button>
          {bookmarkedChapterIds[chapter.id] && (
            <button
              className="btn-icon"
              title={latestBookmark?.chapterId === chapter.id ? 'Continue reading from here' : 'You have a reading bookmark here'}
              onClick={() => openExplanation(
                chapter.id,
                false,
                latestBookmark?.chapterId === chapter.id ? (latestBookmark.scrollRatio ?? 0) : null,
              )}
              style={{ opacity: latestBookmark?.chapterId === chapter.id ? 1 : 0.55 }}
            >🔖</button>
          )}
          <button
            className="btn-icon"
            title="Edit chapter"
            onClick={() => { setEditChapter(chapter); setShowChapterForm(true); }}
          >✏️</button>
          <button
            className="btn-icon"
            title="Delete chapter"
            onClick={() => setDeleteTarget({ type: 'chapter', id: chapter.id, name: chapter.title })}
          >🗑️</button>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {expandedChapters[chapter.id] ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expandedChapters[chapter.id] && (
        <div className="chapter-body">
          {(!chapterIdeas[chapter.id] || chapterIdeas[chapter.id].length === 0) ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <p className="empty-state-text" style={{ fontSize: '0.85rem' }}>
                No key ideas yet for this chapter.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowIdeaForm(chapter.id)}
              >
                + Add First Idea
              </button>
            </div>
          ) : (
            <div className="idea-list">
              {chapterIdeas[chapter.id].map(idea => (
                <div key={idea.id} className="idea-card">
                  <div className="idea-content"><ReactMarkdown>{idea.content}</ReactMarkdown></div>
                  {idea.example && (
                    <div className="idea-example"><ReactMarkdown>{idea.example}</ReactMarkdown></div>
                  )}
                  <div className="idea-actions">
                    <button
                      className="btn-icon"
                      title={idea.highlighted ? 'Remove from Idea Bank' : 'Add to Idea Bank'}
                      onClick={() => handleToggleHighlight(idea, chapter.id)}
                      style={{
                        color: idea.highlighted ? '#FFD54F' : 'var(--text-secondary)',
                        fontSize: '1.05rem',
                        opacity: idea.highlighted ? 1 : 0.45,
                        transition: 'color 0.2s, opacity 0.2s',
                      }}
                    >
                      {idea.highlighted ? '★' : '☆'}
                    </button>
                    <button
                      className="btn-icon"
                      title="Edit idea"
                      onClick={() => setEditIdea({ ...idea, chapterId: chapter.id })}
                    >✏️</button>
                    <button
                      className="btn-icon"
                      title="Delete idea"
                      onClick={() => setDeleteTarget({
                        type: 'idea',
                        id: idea.id,
                        chapterId: chapter.id,
                        name: idea.content.substring(0, 50),
                      })}
                    >🗑️</button>
                  </div>
                </div>
              ))}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowIdeaForm(chapter.id)}
                style={{ alignSelf: 'flex-start' }}
              >
                + Add Idea
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <Link to={backTo} state={backState} className="back-link">{backLabel}</Link>

      <div className="book-detail-header">
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          {book.coverUrl && (
            <img
              src={book.coverUrl}
              alt={book.title}
              style={{ width: '120px', minHeight: '170px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)', flexShrink: 0 }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          )}
          <div style={{ flex: 1 }}>
            <h1 className="book-detail-title">{book.title}</h1>
            {book.author && <div className="book-detail-author">by {book.author}</div>}
            <div style={{ margin: '0.5rem 0' }}>
              <ReadingStatusControl status={book.readingStatus} onChange={handleStatusChange} />
            </div>
            {book.description && <p className="book-detail-desc">{book.description}</p>}
            {latestBookmark && (
              <div className="continue-reading">
                <button className="btn btn-primary btn-sm" onClick={continueReading}>
                  ▶ Continue reading
                </button>
                <span className="continue-reading-meta">
                  Last read: <strong>{latestBookmark.chapterTitle || 'Chapter'}</strong>
                  {' · '}{formatBookmarkTime(latestBookmark.createdAt)}
                  {latestBookmark.scrollRatio != null && ` · ~${Math.round(latestBookmark.scrollRatio * 100)}%`}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {book.isbn && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  ISBN: {book.isbn}
                </span>
              )}
              <button className="btn btn-secondary btn-sm" onClick={handleExport}>
                📥 Export JSON
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowExplanationExport(true)}>
                📄 Export Explanations
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMarks(true)}>
                📑 Saved Passages ({marks.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-header">
        <h2 className="section-title">{isParts ? 'Parts' : 'Chapters'}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowJsonImport(true)}
          >
            Import JSON
          </button>
          {isParts ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setEditPart(null); setShowPartForm(true); }}
            >
              + Add Part
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setEditChapter(null); setAddChapterPartId(null); setShowChapterForm(true); }}
            >
              + Add Chapter
            </button>
          )}
        </div>
      </div>

      {isParts ? (
        (() => {
          const partIdSet = new Set(parts.map(p => p.id));
          // Chapters whose partId matches no existing part (null or stale) fall
          // into the "Ungrouped" bucket so they stay visible and draggable.
          const ungroupedChapters = chapters.filter(c => !partIdSet.has(c.partId));
          if (parts.length === 0 && ungroupedChapters.length === 0) {
            return (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <p className="empty-state-text">No parts yet. Add parts, then add chapters inside each part.</p>
              </div>
            );
          }
          return (
          <div className="part-list">
            {parts.map((part, pIdx) => {
              const partChapters = chapters.filter(c => c.partId === part.id);
              const isCollapsed = !!collapsedParts[part.id];
              const isDragOver = dragOverPartId === part.id;
              return (
                <div
                  key={part.id}
                  className={`part-item${isCollapsed ? ' part-item--collapsed' : ''}${isDragOver ? ' part-item--drag-over' : ''}`}
                  onDragOver={e => { if (draggedChapterId != null) { e.preventDefault(); setDragOverPartId(part.id); } }}
                  onDragLeave={() => setDragOverPartId(prev => (prev === part.id ? null : prev))}
                  onDrop={e => { e.preventDefault(); handleChapterReassign(draggedChapterId, part.id); setDragOverPartId(null); setDraggedChapterId(null); }}
                >
                  <div className="part-header">
                    <button
                      type="button"
                      className="part-header-left part-toggle"
                      onClick={() => togglePart(part.id)}
                      aria-expanded={!isCollapsed}
                      title={isCollapsed ? 'Expand part' : 'Collapse part'}
                    >
                      <span className={`part-chevron${isCollapsed ? ' part-chevron--collapsed' : ''}`}>▾</span>
                      <span className="part-number">Part {part.orderIndex || pIdx + 1}</span>
                      <div>
                        <div className="part-title">{part.title}</div>
                        {part.summary && <div className="chapter-summary"><ReactMarkdown>{part.summary}</ReactMarkdown></div>}
                        <div className="part-chapter-count">{partChapters.length} {partChapters.length === 1 ? 'chapter' : 'chapters'}</div>
                      </div>
                    </button>
                    <div className="chapter-actions">
                      <button
                        className="btn-icon"
                        title="Add chapter to this part"
                        onClick={() => { setEditChapter(null); setAddChapterPartId(part.id); setShowChapterForm(true); }}
                      >➕</button>
                      <button
                        className="btn-icon"
                        title="Edit part"
                        onClick={() => { setEditPart(part); setShowPartForm(true); }}
                      >✏️</button>
                      <button
                        className="btn-icon"
                        title="Delete part"
                        onClick={() => setDeleteTarget({ type: 'part', id: part.id, name: part.title })}
                      >🗑️</button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    partChapters.length === 0 ? (
                      <div className="empty-state" style={{ padding: '1rem' }}>
                        <p className="empty-state-text" style={{ fontSize: '0.85rem' }}>No chapters in this part yet.</p>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setEditChapter(null); setAddChapterPartId(part.id); setShowChapterForm(true); }}
                        >
                          + Add Chapter
                        </button>
                      </div>
                    ) : (
                      <div className="chapter-list">
                        {partChapters.map((chapter, idx) => renderChapter(chapter, idx))}
                      </div>
                    )
                  )}
                </div>
              );
            })}
            {ungroupedChapters.length > 0 && (
              <div
                className={`part-item part-item--ungrouped${dragOverPartId === 'ungrouped' ? ' part-item--drag-over' : ''}`}
                onDragOver={e => { if (draggedChapterId != null) { e.preventDefault(); setDragOverPartId('ungrouped'); } }}
                onDragLeave={() => setDragOverPartId(prev => (prev === 'ungrouped' ? null : prev))}
                onDrop={e => { e.preventDefault(); handleChapterReassign(draggedChapterId, null); setDragOverPartId(null); setDraggedChapterId(null); }}
              >
                <div className="part-header">
                  <div className="part-header-left">
                    <span className="part-number part-number--ungrouped">Ungrouped</span>
                    <div>
                      <div className="part-title">Unassigned chapters</div>
                      <div className="part-chapter-count">{ungroupedChapters.length} {ungroupedChapters.length === 1 ? 'chapter' : 'chapters'} · drag each into a part above</div>
                    </div>
                  </div>
                  <div className="chapter-actions">
                    <button
                      className="btn-icon"
                      title="Add an ungrouped chapter"
                      onClick={() => { setEditChapter(null); setAddChapterPartId(null); setShowChapterForm(true); }}
                    >➕</button>
                  </div>
                </div>
                <div className="chapter-list">
                  {ungroupedChapters.map((chapter, idx) => renderChapter(chapter, idx))}
                </div>
              </div>
            )}
          </div>
          );
        })()
      ) : (
        chapters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📑</div>
            <p className="empty-state-text">No chapters yet. Add the book's structure to start logging ideas.</p>
          </div>
        ) : (
          <div className="chapter-list">
            {chapters.map((chapter, idx) => renderChapter(chapter, idx))}
          </div>
        )
      )}

      {showJsonImport && (
        <JsonImportModal
          title="Import JSON"
          tabs={[
            isParts
              ? { key: 'parts', label: 'Parts', placeholder: PARTS_JSON_HINT, onImport: handleStructureImport }
              : { key: 'chapters', label: 'Chapters', placeholder: CHAPTERS_JSON_HINT, onImport: handleStructureImport, addOnly: true },
            { key: 'ideas', label: 'Ideas (All)', placeholder: IDEAS_JSON_HINT, onImport: handleGroupedImport('ideas') },
            { key: 'excerpts', label: 'Excerpts (All)', placeholder: EXCERPTS_JSON_HINT, onImport: handleGroupedImport('excerpts') },
          ]}
          onClose={() => setShowJsonImport(false)}
        />
      )}

      {showChapterImport && (
        <JsonImportModal
          title={`Import — ${chapters.find(c => c.id === showChapterImport)?.title || 'Chapter'}`}
          tabs={[
            { key: 'ideas', label: 'Ideas', placeholder: CHAPTER_IDEAS_HINT, onImport: handleChapterImport(showChapterImport, 'ideas') },
            { key: 'excerpts', label: 'Excerpts', placeholder: CHAPTER_EXCERPTS_HINT, onImport: handleChapterImport(showChapterImport, 'excerpts') },
            { key: 'combined', label: 'Ideas + Excerpts', placeholder: CHAPTER_COMBINED_HINT, onImport: handleChapterImport(showChapterImport, 'combined') },
          ]}
          onClose={() => setShowChapterImport(null)}
        />
      )}

      {(showExcerptForm || editExcerpt) && (
        <ExcerptForm
          key={editExcerpt?.id ?? 'new'}
          excerpt={editExcerpt}
          onSave={handleSaveExcerpt}
          onClose={() => { setShowExcerptForm(null); setEditExcerpt(null); }}
        />
      )}

      {excerptReader && chapterExcerpts[excerptReader.chapterId] && (
        <ExcerptReader
          excerpts={chapterExcerpts[excerptReader.chapterId]}
          startIndex={excerptReader.startIndex}
          chapterTitle={chapters.find(c => c.id === excerptReader.chapterId)?.title || ''}
          onClose={() => setExcerptReader(null)}
          onToggleHighlight={handleToggleExcerptHighlight}
          onEdit={(ex) => {
            setExcerptReader(null);
            setEditExcerpt({ ...ex, chapterId: excerptReader.chapterId });
          }}
          onDelete={(ex) => {
            const currentIdx = (chapterExcerpts[excerptReader.chapterId] ?? []).findIndex(e => e.id === ex.id);
            setExcerptReader(null);
            setDeleteTarget({
              type: 'excerpt',
              id: ex.id,
              chapterId: excerptReader.chapterId,
              name: ex.content.substring(0, 50),
              readerIndex: Math.max(0, currentIdx),
            });
          }}
        />
      )}

      {imageViewer && (
        <ChapterImageViewer
          chapterId={imageViewer}
          chapterTitle={chapters.find(c => c.id === imageViewer)?.title || ''}
          onClose={() => setImageViewer(null)}
        />
      )}

      {showChapterForm && (
        <ChapterForm
          key={editChapter?.id ?? 'new'}
          chapter={editChapter}
          onSave={handleSaveChapter}
          onClose={() => { setShowChapterForm(false); setEditChapter(null); setAddChapterPartId(null); }}
        />
      )}

      {showPartForm && (
        <PartForm
          key={editPart?.id ?? 'new'}
          part={editPart}
          onSave={handleSavePart}
          onClose={() => { setShowPartForm(false); setEditPart(null); }}
        />
      )}

      {(showIdeaForm || editIdea) && (
        <IdeaForm
          key={editIdea?.id ?? 'new'}
          idea={editIdea}
          onSave={handleSaveIdea}
          onClose={() => { setShowIdeaForm(null); setEditIdea(null); }}
        />
      )}

      {explanationModal && (
        <ChapterExplanationModal
          chapterTitle={chapters.find(c => c.id === explanationModal.chapterId)?.title || 'Chapter'}
          bookTitle={book.title}
          explanation={explanationModal.data}
          startInEdit={explanationModal.startInEdit}
          initialScrollRatio={explanationModal.initialScrollRatio}
          initialAnchor={explanationModal.initialAnchor}
          saving={savingExplanation}
          bookmarking={savingBookmark}
          onClose={() => setExplanationModal(null)}
          onSave={handleSaveExplanation}
          onDelete={handleDeleteExplanation}
          onBookmark={handleBookmark}
          onSaveMark={handleSaveMark}
          onDeleteMark={handleDeleteMark}
          marks={marks.filter(m => m.chapterId === explanationModal.chapterId)}
          onAnchorResult={handleAnchorResult}
        />
      )}

      {showMarks && (
        <ExplanationMarksPanel
          marks={marks}
          staleIds={staleMarkIds}
          onJump={jumpToMark}
          onUpdateNote={handleUpdateMarkNote}
          onDelete={handleDeleteMark}
          onClose={() => setShowMarks(false)}
        />
      )}

      {showExplanationExport && (
        <ExplanationExportModal
          chapters={buildExplanationExportChapters()}
          totalChapters={chapters.length}
          bookTitle={book.title}
          fetchContent={(chapterId) => explanationApi.get(chapterId)}
          onClose={() => setShowExplanationExport(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Delete ${deleteTarget.type} "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
