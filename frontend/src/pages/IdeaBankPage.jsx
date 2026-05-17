import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ideaBankApi, bookApi } from '../api';

function TagChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.65rem',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-body)',
        border: '1px solid',
        cursor: 'pointer',
        transition: 'all 0.15s',
        background: active ? 'var(--accent)' : 'transparent',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function BookPickerModal({ books, selectedId, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  const filtered = books.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    (b.author || '').toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          width: '400px',
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.2rem 0.75rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
            Select a Book
          </span>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1, padding: '0.1rem 0.3rem',
          }}>&times;</button>
        </div>

        {/* Search */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or author..."
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid var(--input-border)', borderRadius: '6px',
              padding: '0.5rem 0.75rem', fontSize: '0.9rem',
              fontFamily: 'var(--font-body)',
              background: 'var(--input-bg)', color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* List */}
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          <button
            type="button"
            onClick={() => { onSelect(''); onClose(); }}
            style={{
              display: 'block', width: '100%', padding: '0.7rem 1.2rem',
              textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)',
              background: !selectedId ? 'var(--bg-secondary)' : 'transparent',
              color: 'var(--text-secondary)', fontFamily: 'var(--font-body)',
              fontSize: '0.88rem', cursor: 'pointer',
            }}
          >
            All Books
          </button>

          {filtered.length === 0 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              No books found
            </div>
          )}

          {filtered.map(b => (
            <button
              key={b.id}
              type="button"
              onClick={() => { onSelect(b.id); onClose(); }}
              style={{
                display: 'block', width: '100%', padding: '0.7rem 1.2rem',
                textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)',
                background: String(b.id) === String(selectedId) ? 'var(--bg-secondary)' : 'transparent',
                color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                fontSize: '0.92rem', cursor: 'pointer',
                fontWeight: String(b.id) === String(selectedId) ? 600 : 400,
              }}
            >
              {b.title}
              {b.author && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '0.15rem' }}>
                  {b.author}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function BookPicker({ books, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const selected = books.find(b => String(b.id) === String(selectedId));

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.45rem 0.85rem',
          border: '1px solid',
          borderColor: selected ? 'var(--accent)' : 'var(--input-border)',
          borderRadius: '6px',
          background: selected ? 'var(--bg-secondary)' : 'var(--input-bg)',
          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-body)', fontSize: '0.88rem',
          cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: '240px',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.title : 'All Books'}
        </span>
        {selected && (
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(''); }}
            style={{ marginLeft: '0.2rem', opacity: 0.5, fontSize: '0.8rem', cursor: 'pointer' }}
          >&times;</span>
        )}
        <span style={{ opacity: 0.4, fontSize: '0.65rem', marginLeft: '0.3rem' }}>&#128269;</span>
      </button>

      {open && (
        <BookPickerModal
          books={books}
          selectedId={selectedId}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function IdeaCard({ idea, navigate }) {
  const tags = idea.tags ? idea.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius)',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 1px 4px var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.97rem', lineHeight: 1.65, color: 'var(--text-primary)', margin: 0 }}>
        {idea.content}
      </p>

      {idea.example && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, borderLeft: '3px solid var(--border)', paddingLeft: '0.75rem', fontStyle: 'italic' }}>
          {idea.example}
        </p>
      )}

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.1rem' }}>
          {tags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-block',
                padding: '0.15rem 0.55rem',
                borderRadius: '20px',
                fontSize: '0.72rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate(`/book/${idea.bookId}`)}
        style={{
          marginTop: '0.25rem',
          alignSelf: 'flex-start',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '0.78rem',
          fontFamily: 'var(--font-body)',
          opacity: 0.75,
          textAlign: 'left',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.75')}
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

  const [q, setQ] = useState('');
  const [bookId, setBookId] = useState('');
  const [activeTag, setActiveTag] = useState('');

  const debounceRef = useRef(null);

  const allTags = [...new Set(
    ideas.flatMap(i => (i.tags ? i.tags.split(',').map(t => t.trim()).filter(Boolean) : []))
  )].sort();

  const fetchIdeas = useCallback(async (searchQ, searchBookId, searchTag) => {
    setLoading(true);
    try {
      const data = await ideaBankApi.search({ q: searchQ, bookId: searchBookId || null, tag: searchTag });
      setIdeas(data);
    } catch {
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

      {/* Search & Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          type="text"
          placeholder="Search ideas, examples, books, chapters..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ flex: '1 1 280px', minWidth: '200px' }}
        />
        <BookPicker books={books} selectedId={bookId} onSelect={setBookId} />
        {(q || bookId || activeTag) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setQ(''); setBookId(''); setActiveTag(''); }}
            style={{ whiteSpace: 'nowrap' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Tag cloud */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
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

      {!loading && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {ideas.length === 0 ? 'No ideas found' : `${ideas.length} idea${ideas.length !== 1 ? 's' : ''} found`}
        </div>
      )}

      {loading && <div className="loading">Loading ideas</div>}

      {!loading && ideas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {ideas.map(idea => (
            <IdeaCard key={idea.id} idea={idea} navigate={navigate} />
          ))}
        </div>
      )}

      {!loading && ideas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#128161;</div>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
            {q || bookId || activeTag ? 'No ideas match your filters' : 'No ideas yet'}
          </p>
          <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
            {q || bookId || activeTag
              ? 'Try adjusting your search or clearing the filters.'
              : 'Star ideas in your books and they will appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}


