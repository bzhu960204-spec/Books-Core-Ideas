import { useState, useEffect } from 'react';
import Modal from './Modal';

export default function ExcerptForm({ excerpt, onSave, onClose }) {
  const [form, setForm] = useState({
    content: '',
    note: '',
    source: '',
    orderIndex: 1,
  });

  useEffect(() => {
    if (excerpt) {
      setForm({
        content: excerpt.content || '',
        note: excerpt.note || '',
        source: excerpt.source || '',
        orderIndex: excerpt.orderIndex || 1,
      });
    }
  }, [excerpt]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    onSave(form);
  };

  return (
    <Modal title={excerpt ? 'Edit Excerpt' : 'Add Excerpt'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Passage *</label>
          <textarea
            className="form-textarea"
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="Paste the excerpt text (Markdown supported)"
            rows={8}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">My Note</label>
          <textarea
            className="form-textarea"
            value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="Why this passage stands out (optional)"
            rows={3}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Source / Location</label>
          <input
            className="form-input"
            type="text"
            value={form.source}
            onChange={e => setForm({ ...form, source: e.target.value })}
            placeholder="e.g. p.42, Section 3.2 (optional)"
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
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{excerpt ? 'Update' : 'Add Excerpt'}</button>
        </div>
      </form>
    </Modal>
  );
}
