import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { bookApi, chapterApi, ideaApi, excerptApi } from '../api';
import ChapterForm from '../components/ChapterForm';
import IdeaForm from '../components/IdeaForm';
import ExcerptForm from '../components/ExcerptForm';
import ExcerptReader from '../components/ExcerptReader';
import ConfirmDialog from '../components/ConfirmDialog';
import JsonImportModal from '../components/JsonImportModal';

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
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState({});
  const [scrollToChapter, setScrollToChapter] = useState(null);
  const chapterRefs = useRef({});
  const [chapterIdeas, setChapterIdeas] = useState({});
  const [chapterExcerpts, setChapterExcerpts] = useState({});

  // Form states
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editChapter, setEditChapter] = useState(null);
  const [showIdeaForm, setShowIdeaForm] = useState(null); // chapterId
  const [editIdea, setEditIdea] = useState(null);
  const [showExcerptForm, setShowExcerptForm] = useState(null); // chapterId
  const [editExcerpt, setEditExcerpt] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type, id, chapterId?, name }
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [showChapterImport, setShowChapterImport] = useState(null); // chapterId
  const [excerptReader, setExcerptReader] = useState(null); // { chapterId, startIndex }

  const loadBook = async () => {
    try {
      const [bookData, chaptersData] = await Promise.all([
        bookApi.get(id),
        chapterApi.getAll(id),
      ]);
      setBook(bookData);
      setChapters(chaptersData);
      // Pre-load excerpt counts for all chapters so the 📖 badges appear immediately
      if (chaptersData.length > 0) {
        const results = await Promise.all(
          chaptersData.map(ch => excerptApi.getAll(ch.id).then(exs => [ch.id, exs]))
        );
        setChapterExcerpts(Object.fromEntries(results));
      }
    } catch {
      console.error('Failed to load book');
    } finally {
      setLoading(false);
    }
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

  // Chapter CRUD
  const handleSaveChapter = async (form) => {
    if (editChapter) {
      await chapterApi.update(id, editChapter.id, form);
    } else {
      await chapterApi.create(id, form);
    }
    setShowChapterForm(false);
    setEditChapter(null);
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
    } else if (deleteTarget.type === 'idea') {
      await ideaApi.delete(deleteTarget.chapterId, deleteTarget.id);
      loadIdeas(deleteTarget.chapterId);
    } else if (deleteTarget.type === 'excerpt') {
      await excerptApi.delete(deleteTarget.chapterId, deleteTarget.id);
      loadExcerpts(deleteTarget.chapterId);
    }
    setDeleteTarget(null);
  };

  const handleChapterJsonImport = async (parsed, mode) => {
    const items = Array.isArray(parsed) ? parsed : [parsed];
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

  return (
    <div>
      <Link to="/" className="back-link">← Back to Library</Link>

      <div className="book-detail-header">
        <h1 className="book-detail-title">{book.title}</h1>
        {book.author && <div className="book-detail-author">by {book.author}</div>}
        {book.description && <p className="book-detail-desc">{book.description}</p>}
        {book.isbn && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            ISBN: {book.isbn}
          </div>
        )}
      </div>

      <div className="section-header">
        <h2 className="section-title">Chapters</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowJsonImport(true)}
          >
            Import JSON
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setEditChapter(null); setShowChapterForm(true); }}
          >
            + Add Chapter
          </button>
        </div>
      </div>

      {chapters.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📑</div>
          <p className="empty-state-text">No chapters yet. Add the book's structure to start logging ideas.</p>
        </div>
      ) : (
        <div className="chapter-list">
          {chapters.map((chapter, idx) => (
            <div key={chapter.id} className="chapter-item" ref={el => chapterRefs.current[chapter.id] = el}>
              <div className="chapter-header" onClick={() => toggleChapter(chapter.id)}>
                <div className="chapter-header-left">
                  <span className="chapter-number">{chapter.orderIndex || idx + 1}</span>
                  <div>
                    <div className="chapter-title">{chapter.title}</div>
                    {chapter.summary && <div className="chapter-summary">{chapter.summary}</div>}
                  </div>
                </div>
                <div className="chapter-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    title="Import JSON for this chapter"
                    onClick={() => setShowChapterImport(chapter.id)}
                  >⬇️</button>
                  {chapterExcerpts[chapter.id] && chapterExcerpts[chapter.id].length > 0 && (
                    <button
                      className="btn-icon excerpt-badge"
                      title="Read excerpts"
                      onClick={() => setExcerptReader({ chapterId: chapter.id, startIndex: 0 })}
                    >📖 {chapterExcerpts[chapter.id].length}</button>
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
          ))}
        </div>
      )}

      {showJsonImport && (
        <JsonImportModal
          title="Import JSON"
          tabs={[
            { key: 'chapters', label: 'Chapters', placeholder: CHAPTERS_JSON_HINT, onImport: handleChapterJsonImport, addOnly: true },
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
            setExcerptReader(null);
            setDeleteTarget({
              type: 'excerpt',
              id: ex.id,
              chapterId: excerptReader.chapterId,
              name: ex.content.substring(0, 50),
            });
          }}
        />
      )}

      {showChapterForm && (
        <ChapterForm
          chapter={editChapter}
          onSave={handleSaveChapter}
          onClose={() => { setShowChapterForm(false); setEditChapter(null); }}
        />
      )}

      {(showIdeaForm || editIdea) && (
        <IdeaForm
          idea={editIdea}
          onSave={handleSaveIdea}
          onClose={() => { setShowIdeaForm(null); setEditIdea(null); }}
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
