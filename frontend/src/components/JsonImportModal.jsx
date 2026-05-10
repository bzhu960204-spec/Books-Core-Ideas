import { useState } from 'react';
import Modal from './Modal';

/**
 * Generic JSON import modal.
 *
 * Props:
 *   title        – modal heading
 *   placeholder  – textarea placeholder (schema hint)
 *   onImport(parsed) – async callback; should throw on validation failure
 *   onClose      – close handler
 */
export default function JsonImportModal({ title, placeholder, onImport, onClose }) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    let parsed;
    try {
      parsed = JSON.parse(raw.trim());
    } catch (err) {
      setError('Invalid JSON — ' + err.message);
      return;
    }

    setStatus('loading');
    try {
      await onImport(parsed);
      setStatus('done');
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err.message || 'Import failed');
      setStatus('idle');
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <textarea
            className="form-textarea json-textarea"
            value={raw}
            onChange={e => { setRaw(e.target.value); setError(''); }}
            placeholder={placeholder}
            rows={14}
            spellCheck={false}
            disabled={status === 'loading' || status === 'done'}
          />
        </div>

        {error && <div className="json-error">{error}</div>}
        {status === 'done' && <div className="json-success">Imported successfully!</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!raw.trim() || status === 'loading' || status === 'done'}
          >
            {status === 'loading' ? 'Importing...' : 'Import'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
