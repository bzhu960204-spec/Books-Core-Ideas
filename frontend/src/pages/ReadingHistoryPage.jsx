import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookmarkApi, bookApi } from '../api';
import BookPicker from '../components/BookPicker';
import ConfirmDialog from '../components/ConfirmDialog';

// Group bookmarks under a human "Today / Yesterday / date" heading.
function dayLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const today = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((start(today) - start(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function timeLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function ReadingHistoryPage() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterBookId, setFilterBookId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadBookmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bookmarkApi.list();
      setBookmarks(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load reading history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookmarks();
    bookApi.getAll().then(setBooks).catch(() => {});
  }, [loadBookmarks]);

  const openBookmark = (b) => {
    navigate(`/book/${b.bookId}`, {
      state: { openExplanation: { chapterId: b.chapterId, scrollRatio: b.scrollRatio ?? 0 } },
    });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await bookmarkApi.delete(confirmDelete.id);
      setConfirmDelete(null);
      loadBookmarks();
    } catch { /* ignore */ }
  };

  const filtered = filterBookId
    ? bookmarks.filter(b => String(b.bookId) === String(filterBookId))
    : bookmarks;

  // Preserve the already-sorted (newest-first) order while grouping by day.
  const groups = [];
  const indexByLabel = {};
  for (const b of filtered) {
    const label = dayLabel(b.createdAt);
    if (indexByLabel[label] === undefined) {
      indexByLabel[label] = groups.length;
      groups.push({ label, items: [] });
    }
    groups[indexByLabel[label]].items.push(b);
  }

  return (
    <div className="bank-page">
      <div className="bank-header">
        <h1>🔖 Reading History</h1>
        <p className="bank-subtitle">Where you left off in each book's explanations</p>
      </div>

      <div className="bank-toolbar">
        <BookPicker books={books} selectedId={filterBookId} onSelect={setFilterBookId} />
        <span className="bank-count">{filtered.length} bookmark{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="bank-error">{error}</div>}
      {loading && <div className="bank-loading">Loading reading history…</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="bank-empty">
          <p>No reading history yet. Open a chapter's explanation and tap “🔖 Mark read here” to save your spot.</p>
        </div>
      )}

      {!loading && groups.map(group => (
        <div key={group.label} className="history-group">
          <h2 className="history-day">{group.label}</h2>
          <div className="history-list">
            {group.items.map(b => (
              <article
                key={b.id}
                className="history-card"
                role="button"
                tabIndex={0}
                onClick={() => openBookmark(b)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBookmark(b); }
                }}
              >
                <div className="history-time">{timeLabel(b.createdAt)}</div>
                <div className="history-main">
                  <div className="history-book">{b.bookTitle}{b.bookAuthor ? ` · ${b.bookAuthor}` : ''}</div>
                  <h3 className="history-chapter">{b.chapterTitle || 'Chapter'}</h3>
                  {b.note && <p className="history-note">{b.note}</p>}
                </div>
                <div className="history-aside">
                  {b.scrollRatio != null && (
                    <span className="history-progress">~{Math.round(b.scrollRatio * 100)}%</span>
                  )}
                  <button
                    className="btn-icon"
                    title="Delete this bookmark"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(b); }}
                  >🗑️</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}

      {confirmDelete && (
        <ConfirmDialog
          message={`Remove the reading bookmark for "${confirmDelete.chapterTitle || 'this chapter'}"?`}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
