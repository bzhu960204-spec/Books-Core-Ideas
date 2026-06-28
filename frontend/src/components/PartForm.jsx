import { useState, useEffect } from 'react';
import Modal from './Modal';

export default function PartForm({ part, onSave, onClose }) {
  const [form, setForm] = useState({
    title: '',
    orderIndex: 1,
    summary: '',
  });

  useEffect(() => {
    if (part) {
      setForm({
        title: part.title || '',
        orderIndex: part.orderIndex || 1,
        summary: part.summary || '',
      });
    }
  }, [part]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  };

  return (
    <Modal title={part ? 'Edit Part' : 'Add Part'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Part Title *</label>
          <input
            className="form-input"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Part I: Foundations"
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
            placeholder="Brief summary of this part"
            rows={3}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{part ? 'Update' : 'Add Part'}</button>
        </div>
      </form>
    </Modal>
  );
}
