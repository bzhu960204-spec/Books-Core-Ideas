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

  useEffect(() => { loadBooks(); }, []);

  const handleSave = async (form) => {
    if (editBook) {
      await bookApi.update(editBook.id, form);
    } else {
      await bookApi.create(form);
    }
    setShowForm(false);
    setEditBook(null);
    loadBooks();
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await bookApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadBooks();
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

      {books.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p className="empty-state-text">Your library is empty. Add your first book to get started!</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Your First Book</button>
        </div>
      ) : (
        <div className="book-grid">
          {books.map(book => (
            <div key={book.id} className="book-card" onClick={() => navigate(`/book/${book.id}`)}>
              <div className="book-card-title">{book.title}</div>
              <div className="book-card-author">{book.author || 'Unknown author'}</div>
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
          ))}
        </div>
      )}

      {showForm && (
        <BookForm
          book={editBook}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditBook(null); }}
        />
      )}

      {showJsonImport && (
        <JsonImportModal
          title="Import Book(s) from JSON"
          placeholder={BOOK_JSON_HINT}
          onImport={handleJsonImport}
          onClose={() => setShowJsonImport(false)}
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
