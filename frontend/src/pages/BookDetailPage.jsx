import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { bookApi, chapterApi, partApi, ideaApi, excerptApi, chapterImageApi, explanationApi } from '../api';
import ChapterForm from '../components/ChapterForm';
import PartForm from '../components/PartForm';
import IdeaForm from '../components/IdeaForm';
import ExcerptForm from '../components/ExcerptForm';
import ExcerptReader from '../components/ExcerptReader';
import ChapterImageViewer from '../components/ChapterImageViewer';
import ConfirmDialog from '../components/ConfirmDialog';
import JsonImportModal from '../components/JsonImportModal';
import ChapterExplanationModal from '../components/ChapterExplanationModal';
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

export default function BookDetailPage() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [parts, setParts] = useState([]);
  const [collapsedParts, setCollapsedParts] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState({});
  const [scrollToChapter, setScrollToChapter] = useState(null);
  const chapterRefs = useRef({});
  const [chapterIdeas, setChapterIdeas] = useState({});
  const [chapterExcerpts, setChapterExcerpts] = useState({});

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
  const [chapterImageCounts, setChapterImageCounts] = useState({});
  const [chapterHasExplanation, setChapterHasExplanation] = useState({}); // { chapterId: true }
  const [explanationModal, setExplanationModal] = useState(null); // { chapterId, data, startInEdit }
  const [savingExplanation, setSavingExplanation] = useState(false);
  const [showExplanationExport, setShowExplanationExport] = useState(false);
  // Drag-and-drop: reassign a chapter to another part (or to "Ungrouped").
  const [draggedChapterId, setDraggedChapterId] = useState(null);
  const [dragOverPartId, setDragOverPartId] = useState(null); // part id, 'ungrouped', or null

  const handleStatusChange = async (status) => {
    const newStatus = status || null;
    const prev = book;
    setBook(b => ({ ...b, readingStatus: newStatus }));
    try {
      await bookApi.update(book.id, { ...book, readingStatus: newStatus });
    } catch {
      setBook(prev);
    }
  };

  const loadBook = async () => {
    try {
      const [bookData, chaptersData] = await Promise.all([
        bookApi.get(id),
        chapterApi.getAll(id),
      ]);
      setBook(bookData);
      setChapters(chaptersData);
      if (bookData.structureType === 'PARTS') {
        const partsData = await partApi.getAll(id);
        setParts(partsData);
      } else {
        setParts([]);
      }
      // Pre-load excerpt counts for all chapters so the 📖 badges appear immediately
      if (chaptersData.length > 0) {
        const results = await Promise.all(
          chaptersData.map(ch => excerptApi.getAll(ch.id).then(exs => [ch.id, exs]))
        );
        setChapterExcerpts(Object.fromEntries(results));
        // Which chapters already have an explanation (ids only — cheap).
        try {
          const ids = await explanationApi.chapterIds(id);
          setChapterHasExplanation(Object.fromEntries((ids || []).map(cid => [cid, true])));
        } catch { /* ignore */ }
        // Pre-load image counts only when chapter images are enabled
        if (bookData.chapterImagesEnabled) {
          const imgResults = await Promise.all(
            chaptersData.map(ch => chapterImageApi.getAll(ch.id).then(imgs => [ch.id, imgs.length]))
          );
          setChapterImageCounts(Object.fromEntries(imgResults));
        }
      }
    } catch {
      console.error('Failed to load book');
    } finally {
      setLoading(false);
    }
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

  useEffect(() => { loadBook(); }, [id]);

  useEffect(() => {
    if (scrollToChapter && chapterRefs.current[scrollToChapter]) {
      chapterRefs.current[scrollToChapter].scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToChapter(null);
    }
  }, [scrollToChapter, expandedChapters]);

  const toggleChapter = async (chapterId) => {
    const isExpanded = expandedChapters[chapterId];
    setExpandedChapters(isExpanded ? {} : { [chapterId]: true });

    if (!isExpanded) {
      setScrollToChapter(chapterId);
      if (!chapterIdeas[chapterId]) {
        const ideas = await ideaApi.getAll(chapterId);
        setChapterIdeas(prev => ({ ...prev, [chapterId]: ideas }));
      }
      if (!chapterExcerpts[chapterId]) {
        const excerpts = await excerptApi.getAll(chapterId);
        setChapterExcerpts(prev => ({ ...prev, [chapterId]: excerpts }));
      }
    }
  };

  const loadIdeas = async (chapterId) => {
    const ideas = await ideaApi.getAll(chapterId);
    setChapterIdeas(prev => ({ ...prev, [chapterId]: ideas }));
  };

  const loadExcerpts = async (chapterId) => {
    const excerpts = await excerptApi.getAll(chapterId);
    setChapterExcerpts(prev => ({ ...prev, [chapterId]: excerpts }));
  };

  // Chapter explanation (详解) — open loads the document, then view/edit inline.
  const openExplanation = async (chapterId, startInEdit = false) => {
    let data = null;
    try {
      data = await explanationApi.get(chapterId);
    } catch { /* none yet */ }
    setExplanationModal({ chapterId, data: data || { content: '' }, startInEdit: startInEdit || !data });
  };

  const handleSaveExplanation = async ({ content }) => {
    if (!explanationModal) return;
    const chapterId = explanationModal.chapterId;
    setSavingExplanation(true);
    try {
      const saved = await explanationApi.save(chapterId, { content });
      setChapterHasExplanation(prev => ({ ...prev, [chapterId]: true }));
      // Clear startInEdit so the reader switches to view mode after the first save.
      setExplanationModal(m => (m ? { ...m, data: saved, startInEdit: false } : m));
    } finally {
      setSavingExplanation(false);
    }
  };

  const handleDeleteExplanation = async () => {
    if (!explanationModal) return;
    const chapterId = explanationModal.chapterId;
    await explanationApi.delete(chapterId);
    setChapterHasExplanation(prev => {
      const next = { ...prev };
      delete next[chapterId];
      return next;
    });
    setExplanationModal(null);
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
    loadBook();
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
    loadBook();
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
    loadIdeas(chapterId);
  };

  const handleToggleHighlight = async (idea, chapterId) => {
    await ideaApi.update(chapterId, idea.id, { ...idea, highlighted: !idea.highlighted });
    loadIdeas(chapterId);
  };

  const handleToggleExcerptHighlight = async (excerpt) => {
    await excerptApi.update(excerpt.chapterId || excerptReader?.chapterId, excerpt.id, { ...excerpt, highlighted: !excerpt.highlighted });
    loadExcerpts(excerpt.chapterId || excerptReader?.chapterId);
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
    loadExcerpts(chapterId);
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'chapter') {
      await chapterApi.delete(id, deleteTarget.id);
      loadBook();
    } else if (deleteTarget.type === 'part') {
      await partApi.delete(id, deleteTarget.id);
      loadBook();
    } else if (deleteTarget.type === 'idea') {
      await ideaApi.delete(deleteTarget.chapterId, deleteTarget.id);
      loadIdeas(deleteTarget.chapterId);
    } else if (deleteTarget.type === 'excerpt') {
      await excerptApi.delete(deleteTarget.chapterId, deleteTarget.id);
      const updated = await excerptApi.getAll(deleteTarget.chapterId);
      setChapterExcerpts(prev => ({ ...prev, [deleteTarget.chapterId]: updated }));
      if (updated.length > 0) {
        const newIndex = Math.min(deleteTarget.readerIndex ?? 0, updated.length - 1);
        setExcerptReader({ chapterId: deleteTarget.chapterId, startIndex: newIndex });
      }
    }
    setDeleteTarget(null);
  };

  const handleChapterJsonImport = async (parsed, mode) => {
    const items = Array.isArray(parsed) ? parsed : [parsed];
    // Guard: a Parts-shaped payload (objects with a `chapters` array) is being
    // imported into a flat Chapters book.
    if (items.some(it => Array.isArray(it.chapters))) {
      throw new Error('This looks like a Parts structure (objects contain a "chapters" array). This book uses the Chapters structure — switch the book to "Parts → Chapters" first, or import a flat chapters array.');
    }
    for (const item of items) {
      if (!item.title) throw new Error('Each chapter must have a "title" field.');
    }
    if (mode === 'replace') {
      const existing = await chapterApi.getAll(id);
      for (const ch of existing) {
        await chapterApi.delete(id, ch.id);
      }
    }
    for (const item of items) {
      const { keyIdeas: rawIdeas, excerpts: rawExcerpts, ...chapterFields } = item;
      const chapter = await chapterApi.create(id, chapterFields);
      if (Array.isArray(rawIdeas)) {
        for (const idea of rawIdeas) {
          if (!idea.content) throw new Error('Each idea must have a "content" field.');
          await ideaApi.create(chapter.id, idea);
        }
      }
      if (Array.isArray(rawExcerpts)) {
        for (const ex of rawExcerpts) {
          if (!ex.content) throw new Error('Each excerpt must have a "content" field.');
          await excerptApi.create(chapter.id, ex);
        }
      }
    }
    loadBook();
  };

  const handlePartJsonImport = async (parsed, mode) => {
    const items = Array.isArray(parsed) ? parsed : [parsed];
    // Parts may be imported as bare shells (no `chapters`): existing chapters stay
    // ungrouped and are dragged into the new parts afterwards.
    for (const part of items) {
      if (!part.title) throw new Error('Each part must have a "title" field.');
      if (part.chapters !== undefined && !Array.isArray(part.chapters)) {
        throw new Error(`Part "${part.title}" has a "chapters" field that is not an array.`);
      }
      for (const ch of (part.chapters || [])) {
        if (!ch.title) throw new Error(`Each chapter in part "${part.title}" must have a "title" field.`);
      }
    }
    if (mode === 'replace') {
      const existingParts = await partApi.getAll(id);
      for (const p of existingParts) await partApi.delete(id, p.id);
      // Also clear any stray chapters left ungrouped.
      const existingChapters = await chapterApi.getAll(id);
      for (const ch of existingChapters) await chapterApi.delete(id, ch.id);
    }
    for (const part of items) {
      const { chapters: rawChapters, ...partFields } = part;
      const createdPart = await partApi.create(id, partFields);
      for (const ch of (rawChapters || [])) {
        const { keyIdeas: rawIdeas, excerpts: rawExcerpts, ...chapterFields } = ch;
        const chapter = await chapterApi.create(id, { ...chapterFields, partId: createdPart.id });
        if (Array.isArray(rawIdeas)) {
          for (const idea of rawIdeas) {
            if (!idea.content) throw new Error('Each idea must have a "content" field.');
            await ideaApi.create(chapter.id, idea);
          }
        }
        if (Array.isArray(rawExcerpts)) {
          for (const ex of rawExcerpts) {
            if (!ex.content) throw new Error('Each excerpt must have a "content" field.');
            await excerptApi.create(chapter.id, ex);
          }
        }
      }
    }
    loadBook();
  };

  const resolveChapterId = (chapterRef) => {
    const ch = chapters.find(c =>
      c.title.toLowerCase() === chapterRef.toLowerCase() ||
      c.title.toLowerCase().includes(chapterRef.toLowerCase())
    );
    if (!ch) throw new Error(`Chapter not found: "${chapterRef}". Make sure the chapter title matches.`);
    return ch.id;
  };

  const handleBulkIdeaImport = async (parsed, mode) => {
    const groups = Array.isArray(parsed) ? parsed : [parsed];
    for (const group of groups) {
      if (!group.chapter) throw new Error('Each group must have a "chapter" field (chapter title).');
      if (!Array.isArray(group.ideas) || group.ideas.length === 0) throw new Error(`"ideas" array is required for chapter "${group.chapter}".`);
      for (const idea of group.ideas) {
        if (!idea.content) throw new Error('Each idea must have a "content" field.');
      }
    }
    for (const group of groups) {
      const chapterId = resolveChapterId(group.chapter);
      if (mode === 'replace') {
        const existing = await ideaApi.getAll(chapterId);
        for (const idea of existing) await ideaApi.delete(chapterId, idea.id);
      }
      for (const idea of group.ideas) {
        await ideaApi.create(chapterId, idea);
      }
      loadIdeas(chapterId);
    }
  };

  const handleBulkExcerptImport = async (parsed, mode) => {
    const groups = Array.isArray(parsed) ? parsed : [parsed];
    for (const group of groups) {
      if (!group.chapter) throw new Error('Each group must have a "chapter" field (chapter title).');
      if (!Array.isArray(group.excerpts) || group.excerpts.length === 0) throw new Error(`"excerpts" array is required for chapter "${group.chapter}".`);
      for (const ex of group.excerpts) {
        if (!ex.content) throw new Error('Each excerpt must have a "content" field.');
      }
    }
    for (const group of groups) {
      const chapterId = resolveChapterId(group.chapter);
      if (mode === 'replace') {
        const existing = await excerptApi.getAll(chapterId);
        for (const ex of existing) await excerptApi.delete(chapterId, ex.id);
      }
      for (const ex of group.excerpts) {
        await excerptApi.create(chapterId, ex);
      }
      loadExcerpts(chapterId);
    }
  };

  const handleChapterCombinedImport = (chapterId) => async (parsed, mode) => {
    const obj = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!obj || (!obj.ideas && !obj.excerpts)) throw new Error('Object must have an "ideas" and/or "excerpts" array.');
    if (obj.ideas) {
      for (const item of obj.ideas) {
        if (!item.content) throw new Error('Each idea must have a "content" field.');
      }
    }
    if (obj.excerpts) {
      for (const item of obj.excerpts) {
        if (!item.content) throw new Error('Each excerpt must have a "content" field.');
      }
    }
    if (mode === 'replace') {
      if (obj.ideas) {
        const existing = await ideaApi.getAll(chapterId);
        for (const idea of existing) await ideaApi.delete(chapterId, idea.id);
      }
      if (obj.excerpts) {
        const existing = await excerptApi.getAll(chapterId);
        for (const ex of existing) await excerptApi.delete(chapterId, ex.id);
      }
    }
    if (obj.ideas) {
      for (const item of obj.ideas) await ideaApi.create(chapterId, item);
      loadIdeas(chapterId);
    }
    if (obj.excerpts) {
      for (const item of obj.excerpts) await excerptApi.create(chapterId, item);
      loadExcerpts(chapterId);
    }
  };

  if (loading) return <div className="loading">Loading book</div>;
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
    setChapters(prev => prev.map(c => (c.id === chapterId ? { ...c, partId: newPartId } : c)));
    try {
      await chapterApi.update(id, chapterId, {
        title: chapter.title,
        orderIndex: chapter.orderIndex,
        summary: chapter.summary,
        partId: newPartId,
      });
    } catch {
      setChapters(prev => prev.map(c => (c.id === chapterId ? { ...c, partId: currentPartId } : c)));
    }
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
      <Link to="/" className="back-link">← Back to Library</Link>

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
              ? { key: 'parts', label: 'Parts', placeholder: PARTS_JSON_HINT, onImport: handlePartJsonImport }
              : { key: 'chapters', label: 'Chapters', placeholder: CHAPTERS_JSON_HINT, onImport: handleChapterJsonImport, addOnly: true },
            { key: 'ideas', label: 'Ideas (All)', placeholder: IDEAS_JSON_HINT, onImport: handleBulkIdeaImport },
            { key: 'excerpts', label: 'Excerpts (All)', placeholder: EXCERPTS_JSON_HINT, onImport: handleBulkExcerptImport },
          ]}
          onClose={() => setShowJsonImport(false)}
        />
      )}

      {showChapterImport && (
        <JsonImportModal
          title={`Import — ${chapters.find(c => c.id === showChapterImport)?.title || 'Chapter'}`}
          tabs={[
            { key: 'ideas', label: 'Ideas', placeholder: CHAPTER_IDEAS_HINT, onImport: (parsed, mode) => {
              const items = Array.isArray(parsed) ? parsed : [parsed];
              for (const item of items) { if (!item.content) throw new Error('Each idea must have a "content" field.'); }
              return (async () => {
                if (mode === 'replace') { const ex = await ideaApi.getAll(showChapterImport); for (const i of ex) await ideaApi.delete(showChapterImport, i.id); }
                for (const item of items) await ideaApi.create(showChapterImport, item);
                loadIdeas(showChapterImport);
              })();
            }},
            { key: 'excerpts', label: 'Excerpts', placeholder: CHAPTER_EXCERPTS_HINT, onImport: (parsed, mode) => {
              const items = Array.isArray(parsed) ? parsed : [parsed];
              for (const item of items) { if (!item.content) throw new Error('Each excerpt must have a "content" field.'); }
              return (async () => {
                if (mode === 'replace') { const ex = await excerptApi.getAll(showChapterImport); for (const e of ex) await excerptApi.delete(showChapterImport, e.id); }
                for (const item of items) await excerptApi.create(showChapterImport, item);
                loadExcerpts(showChapterImport);
              })();
            }},
            { key: 'combined', label: 'Ideas + Excerpts', placeholder: CHAPTER_COMBINED_HINT, onImport: handleChapterCombinedImport(showChapterImport) },
          ]}
          onClose={() => setShowChapterImport(null)}
        />
      )}

      {(showExcerptForm || editExcerpt) && (
        <ExcerptForm
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
          onImagesChange={async () => {
            const imgs = await chapterImageApi.getAll(imageViewer);
            setChapterImageCounts(prev => ({ ...prev, [imageViewer]: imgs.length }));
          }}
        />
      )}

      {showChapterForm && (
        <ChapterForm
          chapter={editChapter}
          onSave={handleSaveChapter}
          onClose={() => { setShowChapterForm(false); setEditChapter(null); setAddChapterPartId(null); }}
        />
      )}

      {showPartForm && (
        <PartForm
          part={editPart}
          onSave={handleSavePart}
          onClose={() => { setShowPartForm(false); setEditPart(null); }}
        />
      )}

      {(showIdeaForm || editIdea) && (
        <IdeaForm
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
          saving={savingExplanation}
          onClose={() => setExplanationModal(null)}
          onSave={handleSaveExplanation}
          onDelete={handleDeleteExplanation}
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