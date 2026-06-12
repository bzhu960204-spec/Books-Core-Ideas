import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { reviewApi, bookApi } from '../api';
import BookPicker from '../components/BookPicker';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ReviewBankPage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterBookId, setFilterBookId] = useState('');

  // Editing state — keyed by review id (a book can now have multiple reviews)
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // New review state
  const [showNew, setShowNew] = useState(false);
  const [newBookId, setNewBookId] = useState('');
  const [newDraft, setNewDraft] = useState('');

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, bookId, bookTitle }

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

  const handleUpdate = async (review, content) => {
    setSaving(true);
    try {
      await reviewApi.update(review.bookId, review.id, { content });
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
      await reviewApi.create(newBookId, { content: newDraft });
      setShowNew(false);
      setNewBookId('');
      setNewDraft('');
      loadReviews();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await reviewApi.delete(confirmDelete.bookId, confirmDelete.id);
      setConfirmDelete(null);
      if (editingId === confirmDelete.id) setEditingId(null);
      loadReviews();
    } catch { /* ignore */ }
  };

  const filteredReviews = filterBookId
    ? reviews.filter(r => String(r.bookId) === String(filterBookId))
    : reviews;

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
            books={books}
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

            {editingId === r.id ? (
              <>
                <textarea
                  className="review-textarea"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={8}
                />
                <div className="review-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(r, draft)} disabled={saving}>
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
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditingId(r.id); setDraft(r.content); }}>
                    ✏️ Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmDelete({ id: r.id, bookId: r.bookId, bookTitle: r.bookTitle })}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete this review of "${confirmDelete.bookTitle}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
