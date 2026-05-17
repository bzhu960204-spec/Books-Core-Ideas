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
export default function JsonImportModal({ title, placeholder, onImport, onClose, addOnly = false }) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done
  const [mode, setMode] = useState('add'); // add | replace

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
      await onImport(parsed, mode);
      setStatus('done');
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err.message || 'Import failed');
      setStatus('idle');
    }
  };

  const busy = status === 'loading' || status === 'done';

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {!addOnly && (
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
              <button
                type="button"
                onClick={() => setMode('add')}
                disabled={busy}
                style={{
                  padding: '0.35rem 1rem',
                  fontSize: '0.82rem',
                  border: 'none',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  background: mode === 'add' ? 'var(--accent)' : 'var(--surface)',
                  color: mode === 'add' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: mode === 'add' ? 600 : 400,
                  transition: 'background 0.15s',
                }}
              >
                + Add New
              </button>
              <button
                type="button"
                onClick={() => setMode('replace')}
                disabled={busy}
                style={{
                  padding: '0.35rem 1rem',
                  fontSize: '0.82rem',
                  border: 'none',
                  borderLeft: '1px solid var(--border)',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  background: mode === 'replace' ? '#e05252' : 'var(--surface)',
                  color: mode === 'replace' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: mode === 'replace' ? 600 : 400,
                  transition: 'background 0.15s',
                }}
              >
                ↺ Replace All
              </button>
            </div>
            {mode === 'replace' && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#e05252' }}>
                All existing items will be deleted and replaced with the imported data.
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <textarea
            className="form-textarea json-textarea"
            value={raw}
            onChange={e => { setRaw(e.target.value); setError(''); }}
            placeholder={placeholder}
            rows={14}
            spellCheck={false}
            disabled={busy}
          />
        </div>

        {error && <div className="json-error">{error}</div>}
        {status === 'done' && <div className="json-success">Imported successfully!</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!raw.trim() || busy}
            style={mode === 'replace' ? { background: '#e05252', borderColor: '#e05252' } : {}}
          >
            {status === 'loading' ? 'Importing...' : mode === 'replace' ? 'Replace All' : 'Import'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
