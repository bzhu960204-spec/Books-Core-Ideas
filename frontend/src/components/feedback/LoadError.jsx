import { useState } from 'react';
import { describeError } from './toast';

/** A read that failed: what could not be loaded, why, and a Retry (FE-05). */
export default function LoadError({ what, error, onRetry }) {
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <div className="load-error" role="alert">
      <p className="load-error-text">Could not load {what} — {describeError(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={retry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}
