import { useState } from 'react';
import Modal from './Modal';

// The parent mounts a fresh form per chapter (keyed by id), so props only seed state.
export default function ChapterForm({ chapter, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    title: chapter?.title || '',
    orderIndex: chapter?.orderIndex || 1,
    summary: chapter?.summary || '',
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  };

  return (
    <Modal title={chapter ? 'Edit Chapter' : 'Add Chapter'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Chapter Title *</label>
          <input
            className="form-input"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Chapter 1: Introduction"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Order</label>
          <input
            className="form-input"
            type="number"
            min="1"
            value={form.orderIndex}
            onChange={e => setForm({ ...form, orderIndex: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Summary</label>
          <textarea
            className="form-textarea"
            value={form.summary}
            onChange={e => setForm({ ...form, summary: e.target.value })}
            placeholder="Brief summary of this chapter"
            rows={3}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{chapter ? 'Update' : 'Add Chapter'}</button>
        </div>
      </form>
    </Modal>
  );
}
