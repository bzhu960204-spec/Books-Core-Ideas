import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { reviewApi, bookApi } from '../api';
import BookPicker from '../components/BookPicker';

export default function ReviewBankPage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterBookId, setFilterBookId] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState(null); // bookId being edited
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // New review state
  const [showNew, setShowNew] = useState(false);
  const [newBookId, setNewBookId] = useState('');
  const [newDraft, setNewDraft] = useState('');

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reviewApi.getAll();
      setReviews(data);
    } catch (err) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
    bookApi.getAll().then(setBooks).catch(() => {});
  }, [loadReviews]);

  const handleSave = async (bookId, content) => {
    setSaving(true);
    try {
      await reviewApi.save(bookId, { content });
      setEditingId(null);
      loadReviews();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newBookId || !newDraft.trim()) return;
    setSaving(true);
    try {
      await reviewApi.save(newBookId, { content: newDraft });
      setShowNew(false);
      setNewBookId('');
      setNewDraft('');
      loadReviews();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const filteredReviews = filterBookId
    ? reviews.filter(r => String(r.bookId) === filterBookId)
    : reviews;

  // Books that already have reviews
  const booksWithReviews = new Set(reviews.map(r => String(r.bookId)));

  return (
    <div className="bank-page">
      <div className="bank-header">
        <h1>📝 Review Bank</h1>
        <p className="bank-subtitle">Your reading reflections and book reviews</p>
      </div>

      <div className="bank-toolbar">
        <BookPicker
          books={books}
          selectedId={filterBookId}
          onSelect={setFilterBookId}
        />
        <span className="bank-count">{filteredReviews.length} review{filteredReviews.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)} style={{ marginLeft: 'auto' }}>
          + New Review
        </button>
      </div>

      {/* New review form */}
      {showNew && (
        <div className="review-bank-new">
          <div className="review-bank-new-header">
            <h3>Write a New Review</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowNew(false); setNewDraft(''); setNewBookId(''); }}>
              Cancel
            </button>
          </div>
          <BookPicker
            books={books.filter(b => !booksWithReviews.has(String(b.id)))}
            selectedId={newBookId}
            onSelect={setNewBookId}
          />
          <textarea
            className="review-textarea"
            value={newDraft}
            onChange={e => setNewDraft(e.target.value)}
            placeholder="Write your reading review… (Markdown supported)"
            rows={8}
          />
          <div className="review-actions">
            <button className="btn btn-primary btn-sm" onClick={handleCreateNew} disabled={saving || !newBookId || !newDraft.trim()}>
              {saving ? 'Saving…' : 'Save Review'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="bank-error">{error}</div>}
      {loading && <div className="bank-loading">Loading reviews…</div>}

      {!loading && !error && filteredReviews.length === 0 && (
        <div className="bank-empty">
          <p>No reviews yet. Start writing about the books you've read!</p>
        </div>
      )}

      <div className="review-bank-list">
        {filteredReviews.map(r => (
          <div key={r.id} className="review-bank-card">
            <div className="review-bank-card-header">
              <button
                type="button"
                onClick={() => navigate(`/book/${r.bookId}`)}
                className="bank-card-source"
              >
                {r.bookTitle}{r.bookAuthor ? ` · ${r.bookAuthor}` : ''}
              </button>
              {r.updatedAt && (
                <span className="review-bank-date">{r.updatedAt}</span>
              )}
            </div>

            {editingId === r.bookId ? (
              <>
                <textarea
                  className="review-textarea"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={8}
                />
                <div className="review-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => handleSave(r.bookId, draft)} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="review-bank-content">
                  <ReactMarkdown>{r.content}</ReactMarkdown>
                </div>
                <div className="review-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditingId(r.bookId); setDraft(r.content); }}>
                    ✏️ Edit
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
