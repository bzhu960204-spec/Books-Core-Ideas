import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { excerptBankApi, bookApi } from '../api';
import BookPicker from '../components/BookPicker';

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
  const [excerpts, setExcerpts] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [q, setQ] = useState('');
  const [bookId, setBookId] = useState('');

  const debounceRef = useRef(null);

  const fetchExcerpts = useCallback(async (searchQ, searchBookId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await excerptBankApi.search({ q: searchQ, bookId: searchBookId || null });
      setExcerpts(data);
    } catch (err) {
      setError(err.message || 'Failed to load excerpts');
      setExcerpts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bookApi.getAll().then(setBooks).catch(() => {});
    fetchExcerpts('', '');
  }, [fetchExcerpts]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchExcerpts(q, bookId);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q, bookId, fetchExcerpts]);

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
