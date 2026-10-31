import { Component } from 'react';
import { isChunkLoadError, isReloadingForChunk } from '../../chunkReload';

function ErrorScreen({ error, onRetry, root }) {
  const className = `error-screen${root ? ' error-screen--root' : ''}`;
  if (isReloadingForChunk()) return <div className="loading">Reloading</div>;

  // React.lazy keeps a failed import, so only a reload can fetch the chunk again.
  if (isChunkLoadError(error)) {
    return (
      <div className={className} role="alert">
        <div className="empty-state-icon">🔄</div>
        <h1 className="error-screen-title">This page could not be loaded</h1>
        <p className="empty-state-text">
          The app may have been updated since it was opened, or the server is not reachable.
        </p>
        <div className="error-screen-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }

  return (
    <div className={className} role="alert">
      <div className="empty-state-icon">⚠️</div>
      <h1 className="error-screen-title">Something went wrong</h1>
      <p className="empty-state-text">This page hit an unexpected error. Your saved data is not affected.</p>
      <div className="error-screen-actions">
        {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>}
        <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Reload</button>
        <a className="btn btn-secondary" href="/">Back to Library</a>
      </div>
      <details className="error-screen-details">
        <summary>Error details</summary>
        <pre>{error?.stack || String(error)}</pre>
      </details>
    </div>
  );
}

/**
 * Shows an error screen instead of a blank page when rendering throws (FE-05).
 * `resetKey`: a new value (e.g. the next route) clears the error. `root`: the
 * last-resort boundary around the whole app, where the sidebar is gone too.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  // (React itself logs the caught error to the console.)
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <ErrorScreen error={error} root={this.props.root} onRetry={() => this.setState({ error: null })} />;
  }
}
