import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { useBooks, useDebouncedValue, useExcerptSearch } from '../queries';
import BookPicker from '../components/BookPicker';

const NONE = [];

function ExcerptCard({ excerpt, navigate }) {
  return (
    <div className="bank-card excerpt-bank-card">
      <div className="bank-card-content bank-card-content-italic">
        <ReactMarkdown>{excerpt.content}</ReactMarkdown>
      </div>

      {excerpt.note && (
        <div className="bank-card-example">
          <ReactMarkdown>{excerpt.note}</ReactMarkdown>
        </div>
      )}

      <div className="bank-card-footer">
        {excerpt.source && (
          <span className="bank-card-source-label">— {excerpt.source}</span>
        )}
        <button
          type="button"
          onClick={() => navigate(`/book/${excerpt.bookId}`)}
          className="bank-card-source"
        >
          {excerpt.bookTitle}{excerpt.bookAuthor ? ` · ${excerpt.bookAuthor}` : ''} &rsaquo; {excerpt.chapterTitle}
        </button>
      </div>
    </div>
  );
}

export default function ExcerptBankPage() {
  const navigate = useNavigate();
  const books = useBooks().data ?? NONE;

  const [q, setQ] = useState('');
  const [bookId, setBookId] = useState('');

  // Search 300 ms after the last keystroke / filter change.
  const params = useDebouncedValue({ q, bookId: bookId || null }, 300);
  const excerptsQuery = useExcerptSearch(params);
  const excerpts = excerptsQuery.data ?? NONE;
  const loading = excerptsQuery.isPending || excerptsQuery.isPlaceholderData;
  const error = excerptsQuery.error ? (excerptsQuery.error.message || 'Failed to load excerpts') : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Excerpt Bank</h1>
          <div className="page-ornament" />
        </div>
      </div>

      <div className="bank-toolbar">
        <input
          className="form-input bank-search-input"
          type="text"
          placeholder="Search passages, notes, books, chapters..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <BookPicker books={books} selectedId={bookId} onSelect={setBookId} />
        {(q || bookId) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setQ(''); setBookId(''); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && (
        <div className="bank-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bank-count">
          {excerpts.length === 0 ? 'No excerpts found' : `${excerpts.length} excerpt${excerpts.length !== 1 ? 's' : ''} found`}
        </div>
      )}

      {loading && <div className="loading">Loading excerpts</div>}

      {!loading && !error && excerpts.length > 0 && (
        <div className="bank-list">
          {excerpts.map(excerpt => (
            <ExcerptCard key={excerpt.id} excerpt={excerpt} navigate={navigate} />
          ))}
        </div>
      )}

      {!loading && !error && excerpts.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <p className="empty-state-text">
            {q || bookId ? 'No excerpts match your filters' : 'No excerpts yet'}
          </p>
          <p className="empty-state-hint">
            {q || bookId
              ? 'Try adjusting your search or clearing the filters.'
              : 'Star excerpts in your books and they will appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}
