import { useState, useEffect } from 'react';
import Modal from './Modal';

export default function BookForm({ book, onSave, onClose }) {
  const [form, setForm] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    chapterImagesEnabled: false,
  });

  useEffect(() => {
    if (book) {
      setForm({
        title: book.title || '',
        author: book.author || '',
        isbn: book.isbn || '',
        description: book.description || '',
        chapterImagesEnabled: book.chapterImagesEnabled || false,
      });
    }
  }, [book]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
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
          <input
            className="form-input"
            value={form.isbn}
            onChange={e => setForm({ ...form, isbn: e.target.value })}
            placeholder="Enter ISBN (optional)"
          />
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
