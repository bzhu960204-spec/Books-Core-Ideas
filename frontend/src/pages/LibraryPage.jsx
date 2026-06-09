import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookApi, chapterApi, ideaApi } from '../api';
import BookForm from '../components/BookForm';
import ConfirmDialog from '../components/ConfirmDialog';
import JsonImportModal from '../components/JsonImportModal';

const BOOK_JSON_HINT = `// Single book (simple):
{
  "title": "Thinking, Fast and Slow",
  "author": "Daniel Kahneman",
  "isbn": "978-0374533557",
  "description": "A tour of the mind..."
}

// Or with chapters and ideas nested:
{
  "title": "My Book",
  "author": "Author Name",
  "chapters": [
    {
      "title": "Chapter 1",
      "orderIndex": 1,
      "summary": "Overview...",
      "keyIdeas": [
        { "content": "Key concept", "example": "For example...", "orderIndex": 1 }
      ]
    }
  ]
}`;

export default function LibraryPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('title-asc');
  const [filterRating, setFilterRating] = useState(0); // 0 = all
  const [filterCategory, setFilterCategory] = useState(''); // '' = all
  const [filterStatus, setFilterStatus] = useState(''); // '' = all
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();

  const loadBooks = async () => {
    try {
      const data = await bookApi.getAll();
      setBooks(data);
    } catch {
      console.error('Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await bookApi.getCategories();
      setCategories(data);
    } catch {
      console.error('Failed to load categories');
    }
  };

  useEffect(() => { loadBooks(); loadCategories(); }, []);

  const handleSave = async (form) => {
    if (editBook) {
      await bookApi.update(editBook.id, form);
    } else {
      await bookApi.create(form);
    }
    setShowForm(false);
    setEditBook(null);
    loadBooks();
    loadCategories();
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await bookApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadBooks();
    }
  };

  const handleRateBook = async (book, star) => {
    const newRating = book.rating === star ? null : star;
    setBooks(prev => prev.map(b => b.id === book.id ? { ...b, rating: newRating } : b));
    try {
      await bookApi.update(book.id, { ...book, rating: newRating });
    } catch {
      setBooks(prev => prev.map(b => b.id === book.id ? { ...b, rating: book.rating } : b));
    }
  };

  const handleJsonImport = async (parsed) => {
    // Support single object or array of books
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item.title) throw new Error('Each book must have a "title" field.');
      const { chapters: rawChapters, keyIdeas, ...bookFields } = item;
      const book = await bookApi.create(bookFields);

      if (Array.isArray(rawChapters)) {
        for (const rawChapter of rawChapters) {
          if (!rawChapter.title) throw new Error('Each chapter must have a "title" field.');
          const { keyIdeas: rawIdeas, ...chapterFields } = rawChapter;
          const chapter = await chapterApi.create(book.id, chapterFields);

          if (Array.isArray(rawIdeas)) {
            for (const idea of rawIdeas) {
              if (!idea.content) throw new Error('Each idea must have a "content" field.');
              await ideaApi.create(chapter.id, idea);
            }
          }
        }
      }
    }
    loadBooks();
  };

  if (loading) return <div className="loading">Loading library</div>;

  const q = search.trim().toLowerCase();
  const filteredBooks = books
    .filter(b => {
      const matchesSearch = !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q);
      const matchesRating = filterRating === 0 || (b.rating ?? 0) >= filterRating;
      const matchesCategory = !filterCategory || (b.category || '').split(';').map(c => c.trim()).includes(filterCategory);
      const matchesStatus = !filterStatus || b.readingStatus === filterStatus;
      return matchesSearch && matchesRating && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'title-asc') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'title-desc') return (b.title || '').localeCompare(a.title || '');
      if (sortBy === 'author-asc') return (a.author || '').localeCompare(b.author || '');
      if (sortBy === 'author-desc') return (b.author || '').localeCompare(a.author || '');
      if (sortBy === 'rating-desc') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === 'rating-asc') return (a.rating ?? 0) - (b.rating ?? 0);
      return 0;
    });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Library</h1>
          <div className="page-ornament" />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowJsonImport(true)}>
            { '{}'} Import JSON
          </button>
          <button className="btn btn-primary" onClick={() => { setEditBook(null); setShowForm(true); }}>
            + Add Book
          </button>
        </div>
      </div>

      {books.length > 0 && (
        <div className="library-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              className="library-search"
              type="search"
              placeholder="Search by title or author…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="library-sort"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="title-asc">Title A → Z</option>
              <option value="title-desc">Title Z → A</option>
              <option value="author-asc">Author A → Z</option>
              <option value="author-desc">Author Z → A</option>
              <option value="rating-desc">Rating ★ High → Low</option>
              <option value="rating-asc">Rating ★ Low → High</option>
            </select>
            {categories.length > 0 && (
              <select
                className="library-sort"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select
              className="library-sort"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="WANT_TO_READ">Want to Read</option>
              <option value="READING">Reading</option>
              <option value="FINISHED">Finished</option>
            </select>
            <span className="library-count">
              {q || filterRating > 0 || filterCategory || filterStatus ? `${filteredBooks.length} / ${books.length}` : books.length} book{books.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Filter by rating:</span>
            {[1, 2, 3, 4, 5].map(star => (
              <span
                key={star}
                onClick={() => setFilterRating(filterRating === star ? 0 : star)}
                style={{ cursor: 'pointer', fontSize: '1.4rem', color: filterRating >= star ? '#f5a623' : '#ccc' }}
                title={`Show ≥ ${star} star${star > 1 ? 's' : ''}`}
              >★</span>
            ))}
            {filterRating > 0 && (
              <span
                onClick={() => setFilterRating(0)}
                style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}
              >✕ Clear</span>
            )}
          </div>
        </div>
      )}

      {books.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p className="empty-state-text">Your library is empty. Add your first book to get started!</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Your First Book</button>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p className="empty-state-text">No books match your current filters.</p>
        </div>
      ) : (
        <div className="book-grid">
          {filteredBooks.map(book => (
            <div
              key={book.id}
              className={`book-card ${book.coverUrl ? 'has-cover' : ''}`}
              onClick={() => navigate(`/book/${book.id}`)}
            >
              {book.coverUrl && (
                <div className="book-card-cover">
                  <img src={book.coverUrl} alt="" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                </div>
              )}
              <div className="book-card-content">
                <div className="book-card-title">{book.title}</div>
                <div className="book-card-author">{book.author || 'Unknown author'}</div>
                {book.readingStatus && (
                  <span className={`reading-status-badge ${book.readingStatus === 'WANT_TO_READ' ? 'want-to-read' : book.readingStatus === 'READING' ? 'reading' : 'finished'}`}>
                    {book.readingStatus === 'WANT_TO_READ' ? '📋 Want to Read' : book.readingStatus === 'READING' ? '📖 Reading' : '✅ Finished'}
                  </span>
                )}
                {book.category && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                    {book.category.split(';').map((cat, idx) => {
                      const trimmed = cat.trim();
                      return trimmed ? <span key={idx} className="book-card-category">{trimmed}</span> : null;
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.1rem', margin: '0.35rem 0' }} onClick={e => e.stopPropagation()}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span
                      key={star}
                      onClick={() => handleRateBook(book, star)}
                      style={{ cursor: 'pointer', fontSize: '1.1rem', color: (book.rating ?? 0) >= star ? '#f5a623' : '#ccc' }}
                      title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    >★</span>
                  ))}
                </div>
                {book.description && <div className="book-card-desc">{book.description}</div>}
                <div className="book-card-meta">
                  <span>{book.chapters?.length || 0} chapters</span>
                  <span style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="btn-icon"
                      title="Edit"
                      onClick={e => { e.stopPropagation(); setEditBook(book); setShowForm(true); }}
                    >✏️</button>
                    <button
                      className="btn-icon"
                      title="Delete"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(book); }}
                    >🗑️</button>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <BookForm
          book={editBook}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditBook(null); }}
          onCategoryChange={() => { loadBooks(); loadCategories(); }}
        />
      )}

      {showJsonImport && (
        <JsonImportModal
          title="Import Book(s) from JSON"
          placeholder={BOOK_JSON_HINT}
          onImport={handleJsonImport}
          onClose={() => setShowJsonImport(false)}
          addOnly
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Are you sure you want to delete "${deleteTarget.title}"? All chapters and ideas will be lost.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
