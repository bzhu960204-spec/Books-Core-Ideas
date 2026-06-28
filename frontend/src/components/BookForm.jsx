import { useState, useEffect } from 'react';
import { bookApi } from '../api';
import Modal from './Modal';

export default function BookForm({ book, onSave, onClose, onCategoryChange }) {
  const [form, setForm] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    coverUrl: '',
    categories: [],
    readingStatus: '',
    chapterImagesEnabled: false,
    structureType: 'CHAPTERS',
  });
  const [categoryInput, setCategoryInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [fetchingCover, setFetchingCover] = useState(false);
  const [coverError, setCoverError] = useState('');

  const [allCategories, setAllCategories] = useState([]);

  useEffect(() => {
    bookApi.getCategories().then(setAllCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (book) {
      const categories = book.category 
        ? book.category.split(';').map(c => c.trim()).filter(c => c)
        : [];
      setForm({
        title: book.title || '',
        author: book.author || '',
        isbn: book.isbn || '',
        description: book.description || '',
        coverUrl: book.coverUrl || '',
        categories: categories,
        readingStatus: book.readingStatus || '',
        chapterImagesEnabled: book.chapterImagesEnabled || false,
        structureType: book.structureType || 'CHAPTERS',
      });
    }
  }, [book]);

  const handleCategoryInputChange = (value) => {
    setCategoryInput(value);
    if (value.trim()) {
      const filtered = allCategories.filter(
        c => c.toLowerCase().includes(value.toLowerCase()) && 
             !form.categories.includes(c)
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const addCategory = async (category) => {
    const trimmed = category.trim();
    if (trimmed && !form.categories.includes(trimmed)) {
      const newCategories = [...form.categories, trimmed];
      setForm(prev => ({ ...prev, categories: newCategories }));
      setCategoryInput('');
      setSuggestions([]);
      if (book?.id) {
        await bookApi.update(book.id, { ...book, category: newCategories.join(';') });
        onCategoryChange?.();
      }
    }
  };

  const removeCategory = async (category) => {
    const newCategories = form.categories.filter(c => c !== category);
    setForm(prev => ({ ...prev, categories: newCategories }));
    if (book?.id) {
      await bookApi.update(book.id, { ...book, category: newCategories.join(';') });
      onCategoryChange?.();
    }
  };

  const handleCategoryKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCategory(categoryInput);
    }
  };

  const handleFetchCover = async () => {
    const isbn = form.isbn.replace(/[-\s]/g, '');
    if (!isbn) return;
    setFetchingCover(true);
    setCoverError('');
    try {
      const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
      if (!res.ok) throw new Error('Book not found');
      const data = await res.json();
      
      const updates = {};
      if (data.title && !form.title) updates.title = data.title;
      if (data.description) {
        const desc = typeof data.description === 'string' ? data.description : data.description.value || '';
        if (desc && !form.description) updates.description = desc;
      }
      
      // Build candidate cover URLs
      const coverCandidates = [];
      if (data.covers && data.covers.length > 0) {
        coverCandidates.push(`https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`);
      }
      coverCandidates.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);

      // Validate cover: load the image and check it's not a 1x1 placeholder
      let validCoverUrl = '';
      for (const url of coverCandidates) {
        const valid = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth > 10 && img.naturalHeight > 10);
          img.onerror = () => resolve(false);
          img.src = url;
        });
        if (valid) {
          validCoverUrl = url;
          break;
        }
      }
      if (validCoverUrl) {
        updates.coverUrl = validCoverUrl;
      }

      // Get author
      if (!form.author && data.authors && data.authors.length > 0) {
        const authorKey = data.authors[0].key || data.authors[0];
        if (typeof authorKey === 'string' && authorKey.startsWith('/authors/')) {
          const authorRes = await fetch(`https://openlibrary.org${authorKey}.json`);
          if (authorRes.ok) {
            const authorData = await authorRes.json();
            if (authorData.name) updates.author = authorData.name;
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        setCoverError('Found book data but no cover image available');
      }
      setForm(prev => ({ ...prev, ...updates }));
    } catch {
      setCoverError('Could not find book info for this ISBN');
    } finally {
      setFetchingCover(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      ...form,
      category: form.categories.join(';')
    });
  };

  return (
    <Modal title={book ? 'Edit Book' : 'Add New Book'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input
            className="form-input"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Enter book title"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Author</label>
          <input
            className="form-input"
            value={form.author}
            onChange={e => setForm({ ...form, author: e.target.value })}
            placeholder="Enter author name"
          />
        </div>
        <div className="form-group">
          <label className="form-label">ISBN</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="form-input"
              value={form.isbn}
              onChange={e => setForm({ ...form, isbn: e.target.value })}
              placeholder="Enter ISBN (optional)"
              style={{ flex: 1 }}
            />
            {form.isbn && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleFetchCover}
                disabled={fetchingCover}
                style={{ whiteSpace: 'nowrap' }}
              >
                {fetchingCover ? '…' : '🌐 Fetch Info'}
              </button>
            )}
          </div>
          {coverError && <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: '0.3rem' }}>{coverError}</div>}
          {form.coverUrl && (
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <img
                src={form.coverUrl}
                alt="Cover preview"
                style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, coverUrl: '' }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
              >✕ Remove cover</button>
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description of the book"
            rows={3}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Categories</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {form.categories.map(cat => (
              <span key={cat} className="category-tag">
                {cat}
                <button
                  type="button"
                  onClick={() => removeCategory(cat)}
                  style={{
                    marginLeft: '0.3rem',
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0'
                  }}
                >✕</button>
              </span>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              value={categoryInput}
              onChange={e => handleCategoryInputChange(e.target.value)}
              onKeyDown={handleCategoryKeyDown}
              placeholder="Type a category and press Enter…"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="category-suggestions">
                {suggestions.slice(0, 5).map(s => (
                  <div
                    key={s}
                    className="category-suggestion-item"
                    onClick={() => addCategory(s)}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Reading Status</label>
          <select
            className="form-input"
            value={form.readingStatus}
            onChange={e => setForm({ ...form, readingStatus: e.target.value })}
          >
            <option value="">Not set</option>
            <option value="WANT_TO_READ">Want to Read</option>
            <option value="READING">Reading</option>
            <option value="FINISHED">Finished</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Structure</label>
          <select
            className="form-input"
            value={form.structureType}
            onChange={e => setForm({ ...form, structureType: e.target.value })}
          >
            <option value="CHAPTERS">Chapters only</option>
            <option value="PARTS">Parts → Chapters</option>
          </select>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
            {form.structureType === 'PARTS'
              ? 'This book is divided into Parts, each containing chapters.'
              : 'This book is a flat list of chapters.'}
          </div>
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <input
            type="checkbox"
            id="chapterImagesEnabled"
            checked={form.chapterImagesEnabled}
            onChange={e => setForm({ ...form, chapterImagesEnabled: e.target.checked })}
            style={{ width: '1rem', height: '1rem', cursor: 'pointer', flexShrink: 0 }}
          />
          <label htmlFor="chapterImagesEnabled" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
            Enable chapter images
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{book ? 'Update' : 'Add Book'}</button>
        </div>
      </form>
    </Modal>
  );
}
