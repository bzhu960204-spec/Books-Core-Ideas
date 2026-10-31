import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { useBooks, useDebouncedValue, useIdeaSearch } from '../queries';
import BookPicker from '../components/BookPicker';

const NONE = [];

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
  const books = useBooks().data ?? NONE;

  const [q, setQ] = useState('');
  const [bookId, setBookId] = useState('');
  const [activeTag, setActiveTag] = useState('');

  // Search 300 ms after the last keystroke / filter change.
  const params = useDebouncedValue({ q, bookId: bookId || null, tag: activeTag }, 300);
  const ideasQuery = useIdeaSearch(params);
  const ideas = ideasQuery.data ?? NONE;
  const loading = ideasQuery.isPending || ideasQuery.isPlaceholderData;
  const error = ideasQuery.error ? (ideasQuery.error.message || 'Failed to load ideas') : null;

  const allTags = [...new Set(
    ideas.flatMap(i => (i.tags ? i.tags.split(',').map(t => t.trim()).filter(Boolean) : []))
  )].sort();

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

