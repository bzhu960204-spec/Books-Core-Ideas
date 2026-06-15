import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { reviewApi, bookApi } from '../api';
import BookPicker from '../components/BookPicker';
import ConfirmDialog from '../components/ConfirmDialog';
import RichTextEditor, { normalizeReviewContent } from '../components/RichTextEditor';
import ReviewReaderModal from '../components/ReviewReaderModal';

// Derive a fallback title from review content for legacy reviews that
// have no explicit title yet. Tries first heading, then first non-empty line.
function deriveTitle(content) {
  if (!content) return 'Untitled review';
  const html = normalizeReviewContent(content);
  const headingMatch = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (headingMatch) {
    const text = headingMatch[1].replace(/<[^>]+>/g, '').trim();
    if (text) return text.slice(0, 120);
  }
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 'Untitled review';
  return text.slice(0, 80) + (text.length > 80 ? '…' : '');
}

function getReadingMeta(content) {
  const text = normalizeReviewContent(content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return { words: 0, minutes: 0 };
  const words = text.split(/\s+/).filter(Boolean).length;
  return { words, minutes: Math.max(1, Math.round(words / 220)) };
}

function getExcerpt(content, max = 320) {
  const text = normalizeReviewContent(content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export default function ReviewBankPage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterBookId, setFilterBookId] = useState('');

  // Reader modal state
  const [openId, setOpenId] = useState(null);
  const [openInEdit, setOpenInEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  // New review state
  const [showNew, setShowNew] = useState(false);
  const [newBookId, setNewBookId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDraft, setNewDraft] = useState('');

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  const handleSave = async ({ title, content }) => {
    const review = reviews.find(r => r.id === openId);
    if (!review) return;
    setSaving(true);
    try {
      await reviewApi.update(review.bookId, review.id, { title, content });
      await loadReviews();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newBookId || !newDraft.trim()) return;
    setSaving(true);
    try {
      await reviewApi.create(newBookId, {
        title: newTitle.trim(),
        content: newDraft,
      });
      setShowNew(false);
      setNewBookId('');
      setNewTitle('');
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
      if (openId === confirmDelete.id) setOpenId(null);
      setConfirmDelete(null);
      loadReviews();
    } catch { /* ignore */ }
  };

  const filteredReviews = filterBookId
    ? reviews.filter(r => String(r.bookId) === String(filterBookId))
    : reviews;

  const openReview = reviews.find(r => r.id === openId) || null;

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

      {showNew && (
        <div className="review-bank-new">
          <div className="review-bank-new-header">
            <h3>Write a New Review</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowNew(false); setNewDraft(''); setNewBookId(''); setNewTitle(''); }}>
              Cancel
            </button>
          </div>
          <BookPicker
            books={books}
            selectedId={newBookId}
            onSelect={setNewBookId}
          />
          <input
            type="text"
            className="review-title-input"
            placeholder="Review title…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <RichTextEditor
            value={newDraft}
            onChange={setNewDraft}
            placeholder="Write your reading review…"
            autoFocus
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
        {filteredReviews.map(r => {
          const displayTitle = r.title?.trim() || deriveTitle(r.content);
          const meta = getReadingMeta(r.content);
          const excerpt = getExcerpt(r.content);
          return (
            <article
              key={r.id}
              className="review-bank-card"
              role="button"
              tabIndex={0}
              onClick={() => { setOpenInEdit(false); setOpenId(r.id); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpenInEdit(false);
                  setOpenId(r.id);
                }
              }}
            >
              {r.bookCoverUrl && (
                <div className="review-bank-cover">
                  <img
                    src={r.bookCoverUrl}
                    alt=""
                    onError={e => { e.target.parentElement.style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="review-bank-summary-main">
                <div className="review-bank-eyebrow">
                  <span className="review-bank-source">
                    {r.bookTitle}{r.bookAuthor ? ` · ${r.bookAuthor}` : ''}
                  </span>
                </div>
                <h3 className="review-bank-title">{displayTitle}</h3>
                {excerpt && <p className="review-bank-excerpt">{excerpt}</p>}
                <div className="review-bank-meta">
                  {r.updatedAt && <span className="review-bank-date">{r.updatedAt}</span>}
                  {meta.words > 0 && (
                    <span className="review-bank-readtime">
                      {meta.words} words · ~{meta.minutes} min read
                    </span>
                  )}
                  <span className="review-bank-readmore">Read →</span>
                </div>
              </div>
              <div className="review-bank-card-actions" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => { setOpenInEdit(true); setOpenId(r.id); }}
                  title="Edit"
                  aria-label="Edit"
                >✏️</button>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => setConfirmDelete({ id: r.id, bookId: r.bookId, bookTitle: r.bookTitle })}
                  title="Delete"
                  aria-label="Delete"
                >🗑️</button>
              </div>
            </article>
          );
        })}
      </div>

      {openReview && (
        <ReviewReaderModal
          review={openReview}
          startInEdit={openInEdit}
          saving={saving}
          onClose={() => setOpenId(null)}
          onSave={handleSave}
          onDelete={() => setConfirmDelete({ id: openReview.id, bookId: openReview.bookId, bookTitle: openReview.bookTitle })}
          onOpenBook={() => navigate(`/book/${openReview.bookId}`)}
        />
      )}

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
