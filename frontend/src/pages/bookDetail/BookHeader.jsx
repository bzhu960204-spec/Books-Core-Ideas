import ReadingStatusControl from '../../components/ReadingStatusControl';

// Compact "May 3, 2:14 PM" style timestamp for reading bookmarks.
function formatBookmarkTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Cover, title, reading status, "continue reading" and the book-level actions.
export default function BookHeader({
  book,
  latestBookmark,
  markCount,
  onStatusChange,
  onContinueReading,
  onExportJson,
  onExportExplanations,
  onShowMarks,
}) {
  return (
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
            <ReadingStatusControl status={book.readingStatus} onChange={onStatusChange} />
          </div>
          {book.description && <p className="book-detail-desc">{book.description}</p>}
          {latestBookmark && (
            <div className="continue-reading">
              <button className="btn btn-primary btn-sm" onClick={onContinueReading}>
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
            <button className="btn btn-secondary btn-sm" onClick={onExportJson}>
              📥 Export JSON
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onExportExplanations}>
              📄 Export Explanations
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onShowMarks}>
              📑 Saved Passages ({markCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
