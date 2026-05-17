import { useState, useEffect } from 'react';
import Modal from './Modal';

export default function IdeaForm({ idea, onSave, onClose }) {
  const [form, setForm] = useState({
    content: '',
    example: '',
    tags: '',
    orderIndex: 1,
  });

  useEffect(() => {
    if (idea) {
      setForm({
        content: idea.content || '',
        example: idea.example || '',
        tags: idea.tags || '',
        orderIndex: idea.orderIndex || 1,
      });
    }
  }, [idea]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    onSave(form);
  };

  return (
    <Modal title={idea ? 'Edit Key Idea' : 'Add Key Idea'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Key Idea *</label>
          <textarea
            className="form-textarea"
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="Describe the key idea or concept"
            rows={4}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Example / Notes</label>
          <textarea
            className="form-textarea"
            value={form.example}
            onChange={e => setForm({ ...form, example: e.target.value })}
            placeholder="Add an example or supporting notes (optional)"
            rows={3}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Tags</label>
          <input
            className="form-input"
            type="text"
            value={form.tags}
            onChange={e => setForm({ ...form, tags: e.target.value })}
            placeholder="Comma-separated, e.g. mindset, leadership"
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
          <button type="submit" className="btn btn-primary">{idea ? 'Update' : 'Add Idea'}</button>
        </div>
      </form>
    </Modal>
  );
}
