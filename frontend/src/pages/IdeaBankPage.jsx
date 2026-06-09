import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { ideaBankApi, bookApi } from '../api';
import BookPicker from '../components/BookPicker';

function TagChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tag-chip ${active ? 'active' : ''}`}
    >
      {label}
    </button>
  );
}

function IdeaCard({ idea, navigate }) {
  const tags = idea.tags ? idea.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <div className="bank-card idea-bank-card">
      <div className="bank-card-content">
        <ReactMarkdown>{idea.content}</ReactMarkdown>
      </div>

      {idea.example && (
        <div className="bank-card-example">
          <ReactMarkdown>{idea.example}</ReactMarkdown>
        </div>
      )}

      {tags.length > 0 && (
        <div className="bank-card-tags">
          {tags.map(tag => (
            <span key={tag} className="bank-card-tag">{tag}</span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate(`/book/${idea.bookId}`)}
        className="bank-card-source"
      >
        {idea.bookTitle}{idea.bookAuthor ? ` · ${idea.bookAuthor}` : ''} &rsaquo; {idea.chapterTitle}
      </button>
    </div>
  );
}

export default function IdeaBankPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [q, setQ] = useState('');
  const [bookId, setBookId] = useState('');
  const [activeTag, setActiveTag] = useState('');

  const debounceRef = useRef(null);

  const allTags = [...new Set(
    ideas.flatMap(i => (i.tags ? i.tags.split(',').map(t => t.trim()).filter(Boolean) : []))
  )].sort();

  const fetchIdeas = useCallback(async (searchQ, searchBookId, searchTag) => {
    setLoading(true);
    setError(null);
    try {
      const data = await ideaBankApi.search({ q: searchQ, bookId: searchBookId || null, tag: searchTag });
      setIdeas(data);
    } catch (err) {
      setError(err.message || 'Failed to load ideas');
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bookApi.getAll().then(setBooks).catch(() => {});
    fetchIdeas('', '', '');
  }, [fetchIdeas]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchIdeas(q, bookId, activeTag);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q, bookId, activeTag, fetchIdeas]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Idea Bank</h1>
          <div className="page-ornament" />
        </div>
      </div>

      <div className="bank-toolbar">
        <input
          className="form-input bank-search-input"
          type="text"
          placeholder="Search ideas, examples, books, chapters..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <BookPicker books={books} selectedId={bookId} onSelect={setBookId} />
        {(q || bookId || activeTag) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setQ(''); setBookId(''); setActiveTag(''); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="bank-tag-cloud">
          {allTags.map(tag => (
            <TagChip
              key={tag}
              label={tag}
              active={activeTag === tag}
              onClick={() => setActiveTag(prev => prev === tag ? '' : tag)}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="bank-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bank-count">
          {ideas.length === 0 ? 'No ideas found' : `${ideas.length} idea${ideas.length !== 1 ? 's' : ''} found`}
        </div>
      )}

      {loading && <div className="loading">Loading ideas</div>}

      {!loading && !error && ideas.length > 0 && (
        <div className="bank-grid">
          {ideas.map(idea => (
            <IdeaCard key={idea.id} idea={idea} navigate={navigate} />
          ))}
        </div>
      )}

      {!loading && !error && ideas.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">💡</div>
          <p className="empty-state-text">
            {q || bookId || activeTag ? 'No ideas match your filters' : 'No ideas yet'}
          </p>
          <p className="empty-state-hint">
            {q || bookId || activeTag
              ? 'Try adjusting your search or clearing the filters.'
              : 'Star ideas in your books and they will appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}

