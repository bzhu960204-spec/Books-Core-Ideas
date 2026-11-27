import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { favoriteApi } from '../api';
import { useBooks, useDebouncedValue, useFavorites, useRefresh } from '../queries';
import BookPicker from '../components/BookPicker';
import ConfirmDialog from '../components/ConfirmDialog';
import { attempt } from '../components/feedback/toast';

const NONE = [];
const NOTE_MAX = 500;

function dateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// "By book": one group per book (A–Z), its chapters in reading order.
function groupByBook(favorites) {
  const groups = new Map();
  for (const f of favorites) {
    if (!groups.has(f.bookId)) groups.set(f.bookId, { key: f.bookId, label: f.bookTitle, items: [] });
    groups.get(f.bookId).items.push(f);
  }
  const list = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  for (const g of list) g.items.sort((a, b) => (a.chapterOrderIndex ?? 0) - (b.chapterOrderIndex ?? 0));
  return list;
}

function FavoriteCard({ favorite, onOpen, onSaveNote, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const startEditing = () => { setNote(favorite.note || ''); setEditing(true); };
  const save = async () => {
    setSaving(true);
    const ok = await onSaveNote(favorite, note);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <article className="favorite-card">
      <div
        className="favorite-card-main"
        role="button"
        tabIndex={0}
        onClick={() => onOpen(favorite)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(favorite); }
        }}
        title={favorite.hasExplanation ? 'Open the explanation' : 'Open the chapter (its explanation was deleted)'}
      >
        <div className="history-book">
          {favorite.bookTitle}{favorite.bookAuthor ? ` · ${favorite.bookAuthor}` : ''}
        </div>
        <h3 className="history-chapter">
          {favorite.chapterOrderIndex != null && <span className="favorite-chapter-number">{favorite.chapterOrderIndex}</span>}
          {favorite.chapterTitle || 'Chapter'}
          {!favorite.hasExplanation && <span className="favorite-missing">No explanation</span>}
        </h3>
        {favorite.chapterSummary && (
          <div className="favorite-summary"><ReactMarkdown>{favorite.chapterSummary}</ReactMarkdown></div>
        )}
        {!editing && favorite.note && <p className="favorite-note">“{favorite.note}”</p>}
      </div>

      {editing && (
        <div className="favorite-note-editor">
          <textarea
            className="form-textarea"
            rows={2}
            maxLength={NOTE_MAX}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Why is this chapter worth re-reading?"
            aria-label="Note"
            autoFocus
          />
          <div className="favorite-note-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      )}

      <div className="favorite-card-aside">
        <span className="favorite-date" title="Added to favorites">{dateLabel(favorite.createdAt)}</span>
        <button
          type="button"
          className="btn-icon"
          title={favorite.note ? 'Edit the note' : 'Add a note'}
          onClick={startEditing}
          disabled={editing}
        >✏️</button>
        <button
          type="button"
          className="btn-icon chapter-favorite chapter-favorite--on"
          title="Remove from Favorite Chapters"
          onClick={() => onRemove(favorite)}
        >★</button>
      </div>
    </article>
  );
}

// Chapters starred because their explanation is worth re-reading, across all books.
export default function FavoritesPage() {
  const navigate = useNavigate();
  const books = useBooks().data ?? NONE;
  const refresh = useRefresh();
  const [q, setQ] = useState('');
  const [bookId, setBookId] = useState('');
  const [sort, setSort] = useState('recent');
  const [confirmRemove, setConfirmRemove] = useState(null);

  const params = useDebouncedValue({ q, bookId: bookId || null }, 300);
  const favoritesQuery = useFavorites(params);
  const favorites = favoritesQuery.data ?? NONE;
  const loading = favoritesQuery.isPending;
  const error = favoritesQuery.error ? (favoritesQuery.error.message || 'Failed to load favorite chapters') : null;
  const filtering = !!(q || bookId);

  const open = (f) => {
    navigate(`/book/${f.bookId}`, { state: { openExplanation: { chapterId: f.chapterId, scrollRatio: 0 } } });
  };

  const saveNote = async (f, note) => {
    const ok = await attempt('Could not save the note', () => favoriteApi.add(f.chapterId, note));
    if (ok) refresh();
    return !!ok;
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    if (!await attempt('Could not remove the favorite', () => favoriteApi.remove(confirmRemove.chapterId))) return;
    setConfirmRemove(null);
    refresh();
  };

  const groups = sort === 'book'
    ? groupByBook(favorites)
    : [{ key: 'all', label: null, items: favorites }];

  const card = (f) => (
    <FavoriteCard key={f.id} favorite={f} onOpen={open} onSaveNote={saveNote} onRemove={setConfirmRemove} />
  );

  return (
    <div className="bank-page">
      <div className="bank-header">
        <h1>⭐ Favorite Chapters</h1>
        <p className="bank-subtitle">Chapter explanations worth reading again</p>
      </div>

      <div className="bank-toolbar">
        <input
          className="form-input bank-search-input"
          type="text"
          placeholder="Search chapters, books, notes..."
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label="Search favorite chapters"
        />
        <BookPicker books={books} selectedId={bookId} onSelect={setBookId} />
        <select
          className="library-sort"
          value={sort}
          onChange={e => setSort(e.target.value)}
          aria-label="Sort"
        >
          <option value="recent">Recently added</option>
          <option value="book">By book</option>
        </select>
        <span className="bank-count">{favorites.length} chapter{favorites.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="bank-error">{error}</div>}
      {loading && <div className="loading">Loading favorite chapters</div>}

      {!loading && !error && favorites.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⭐</div>
          <p className="empty-state-text">{filtering ? 'No favorite chapters match your filters' : 'No favorite chapters yet'}</p>
          <p className="empty-state-hint">
            {filtering
              ? 'Try adjusting your search or clearing the filters.'
              : 'Open a chapter’s explanation and tap “☆ Favorite”, or star the chapter in its book.'}
          </p>
        </div>
      )}

      {!loading && groups.map(group => (group.items.length > 0 && (
        <div key={group.key} className="history-group">
          {group.label && <h2 className="history-day">{group.label}</h2>}
          <div className="history-list">{group.items.map(card)}</div>
        </div>
      )))}

      {confirmRemove && (
        <ConfirmDialog
          message={`Remove "${confirmRemove.chapterTitle || 'this chapter'}" from your favorite chapters?`}
          confirmLabel="Remove"
          onConfirm={handleRemove}
          onClose={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
