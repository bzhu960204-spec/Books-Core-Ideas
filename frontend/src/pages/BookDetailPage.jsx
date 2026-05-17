import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { bookApi, chapterApi, ideaApi } from '../api';
import ChapterForm from '../components/ChapterForm';
import IdeaForm from '../components/IdeaForm';
import ConfirmDialog from '../components/ConfirmDialog';
import JsonImportModal from '../components/JsonImportModal';

const CHAPTERS_JSON_HINT = `// Array of chapters (keyIdeas optional):
[
  {
    "title": "Chapter 1: The Beginning",
    "orderIndex": 1,
    "summary": "Overview of the chapter...",
    "keyIdeas": [
      { "content": "Core insight here", "example": "For instance...", "orderIndex": 1 }
    ]
  },
  {
    "title": "Chapter 2: Going Deeper",
    "orderIndex": 2,
    "summary": "..."
  }
]`;

const IDEAS_JSON_HINT = `// Array of key ideas:
[
  {
    "content": "The main concept or insight",
    "example": "A concrete example or note",
    "orderIndex": 1
  },
  {
    "content": "Another important idea",
    "example": "Supporting detail...",
    "orderIndex": 2
  }
]`;

export default function BookDetailPage() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState({});
  const [scrollToChapter, setScrollToChapter] = useState(null);
  const chapterRefs = useRef({});
  const [chapterIdeas, setChapterIdeas] = useState({});

  // Form states
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editChapter, setEditChapter] = useState(null);
  const [showIdeaForm, setShowIdeaForm] = useState(null); // chapterId
  const [editIdea, setEditIdea] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type, id, chapterId?, name }
  const [showChapterJsonImport, setShowChapterJsonImport] = useState(false);
  const [showIdeaJsonImport, setShowIdeaJsonImport] = useState(null); // chapterId

  const loadBook = async () => {
    try {
      const [bookData, chaptersData] = await Promise.all([
        bookApi.get(id),
        chapterApi.getAll(id),
      ]);
      setBook(bookData);
      setChapters(chaptersData);
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
    }
  };

  const loadIdeas = async (chapterId) => {
    const ideas = await ideaApi.getAll(chapterId);
    setChapterIdeas(prev => ({ ...prev, [chapterId]: ideas }));
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

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'chapter') {
      await chapterApi.delete(id, deleteTarget.id);
      loadBook();
    } else if (deleteTarget.type === 'idea') {
      await ideaApi.delete(deleteTarget.chapterId, deleteTarget.id);
      loadIdeas(deleteTarget.chapterId);
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
      const { keyIdeas: rawIdeas, ...chapterFields } = item;
      const chapter = await chapterApi.create(id, chapterFields);
      if (Array.isArray(rawIdeas)) {
        for (const idea of rawIdeas) {
          if (!idea.content) throw new Error('Each idea must have a "content" field.');
          await ideaApi.create(chapter.id, idea);
        }
      }
    }
    loadBook();
  };

  const handleIdeaJsonImport = (chapterId) => async (parsed, mode) => {
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item.content) throw new Error('Each idea must have a "content" field.');
    }
    if (mode === 'replace') {
      const existing = await ideaApi.getAll(chapterId);
      for (const idea of existing) {
        await ideaApi.delete(chapterId, idea.id);
      }
    }
    for (const item of items) {
      await ideaApi.create(chapterId, item);
    }
    loadIdeas(chapterId);
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
            onClick={() => setShowChapterJsonImport(true)}
          >
            {'{}'} Import JSON
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
                    title="Add idea"
                    onClick={() => setShowIdeaForm(chapter.id)}
                  >💡</button>
                  <button
                    className="btn-icon"
                    title="Import ideas from JSON"
                    onClick={() => setShowIdeaJsonImport(chapter.id)}
                  >{'{}'}</button>
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
                          <div className="idea-content">{idea.content}</div>
                          {idea.example && (
                            <div className="idea-example">{idea.example}</div>
                          )}
                          <div className="idea-actions">
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

      {showChapterJsonImport && (
        <JsonImportModal
          title="Import Chapters from JSON"
          placeholder={CHAPTERS_JSON_HINT}
          onImport={handleChapterJsonImport}
          onClose={() => setShowChapterJsonImport(false)}
          addOnly
        />
      )}

      {showIdeaJsonImport && (
        <JsonImportModal
          title="Import Ideas from JSON"
          placeholder={IDEAS_JSON_HINT}
          onImport={handleIdeaJsonImport(showIdeaJsonImport)}
          onClose={() => setShowIdeaJsonImport(null)}
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
