import { useEffect, useMemo, useState } from 'react';
import { bookApi, bookCollectionApi } from '../../api';

/** Sentinel key for books that have no author. */
const UNASSIGNED = '\u0000unassigned';

export default function PickBooksModal({ folderId, existingIds, onClose, onAdded }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState(null); // null = all authors
  const [authorSearch, setAuthorSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [brokenCovers, setBrokenCovers] = useState(() => new Set());

  useEffect(() => {
    bookApi.getAll()
      .then(setBooks)
      .catch(err => console.error('Failed to load books:', err))
      .finally(() => setLoading(false));
  }, []);

  const markCoverBroken = (id) => setBrokenCovers(prev => {
    if (prev.has(id)) return prev;
    const next = new Set(prev);
    next.add(id);
    return next;
  });

  // Distinct authors derived from the loaded books, with counts.
  const authors = useMemo(() => {
    const counts = new Map();
    books.forEach(b => {
      const key = b.author?.trim() || UNASSIGNED;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        count,
        name: key === UNASSIGNED ? 'Unknown author' : key,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [books]);

  const visibleAuthors = useMemo(() => {
    const q = authorSearch.trim().toLowerCase();
    if (!q) return authors;
    return authors.filter(a => a.name.toLowerCase().includes(q));
  }, [authors, authorSearch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter(b => {
      if (author != null && (b.author?.trim() || UNASSIGNED) !== author) return false;
      if (!q) return true;
      return (b.title || '').toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q);
    });
  }, [books, query, author]);

  const toggle = (id) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addSelected = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all([...selected].map(id => bookCollectionApi.addBook(folderId, id)));
      onAdded();
      onClose();
    } catch (err) {
      console.error('Failed to add books:', err);
      alert('Operation failed, please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--lg coll-pick-modal">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="modal-title">Add books from your library</h3>
        <div className="coll-pick-layout">
          <aside className="coll-pick-channels">
            <div className="coll-pick-channels-header">
              <h3>Author</h3>
              {author !== null && (
                <button className="btn-link" onClick={() => setAuthor(null)}>Clear</button>
              )}
            </div>
            <input
              type="text"
              className="coll-pick-channel-search"
              placeholder="Filter authors…"
              value={authorSearch}
              onChange={e => setAuthorSearch(e.target.value)}
            />
            <div className="coll-pick-channel-list">
              <button
                className={`coll-pick-channel-btn${author === null ? ' active' : ''}`}
                onClick={() => setAuthor(null)}
              >
                <span className="coll-pick-channel-name">All authors</span>
                <span className="coll-badge">{books.length}</span>
              </button>
              {visibleAuthors.map(a => (
                <button
                  key={a.key}
                  className={`coll-pick-channel-btn${author === a.key ? ' active' : ''}`}
                  onClick={() => setAuthor(prev => (prev === a.key ? null : a.key))}
                  title={a.name}
                >
                  <span className="coll-pick-channel-avatar">{a.name.charAt(0).toUpperCase()}</span>
                  <span className="coll-pick-channel-name">{a.name}</span>
                  <span className="coll-badge">{a.count}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="coll-pick-main">
            <input
              type="text"
              className="coll-pick-search"
              placeholder="Search by title or author…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />

            {loading ? (
              <p className="coll-tree-empty">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="coll-tree-empty">No books found.</p>
            ) : (
              <ul className="coll-pick-list">
                {filtered.map(b => {
                  const already = existingIds.has(b.id);
                  const checked = already || selected.has(b.id);
                  return (
                    <li key={b.id}>
                      <label className={`coll-pick-row coll-pick-row-book${already ? ' is-added' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={already || saving}
                          onChange={() => toggle(b.id)}
                        />
                        {b.coverUrl && !brokenCovers.has(b.id) ? (
                          <img src={b.coverUrl} alt="" className="coll-pick-thumb" onError={() => markCoverBroken(b.id)} />
                        ) : (
                          <span className="coll-pick-thumb coll-pick-thumb-empty">📖</span>
                        )}
                        <span className="coll-pick-meta">
                          <span className="coll-pick-title" title={b.title}>{b.title}</span>
                          {b.author && <span className="coll-pick-author">{b.author}</span>}
                        </span>
                        {already && <span className="coll-badge">Added</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || selected.size === 0} onClick={addSelected}>
            Add selected ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
