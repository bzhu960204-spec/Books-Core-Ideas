import { Link } from 'react-router-dom';

// Unknown addresses, and books that don't exist (FE-05).
export default function NotFoundPage({ title = 'Page not found', message = 'There is nothing at this address.' }) {
  return (
    <div className="error-screen">
      <div className="empty-state-icon">🧭</div>
      <h1 className="error-screen-title">{title}</h1>
      <p className="empty-state-text">{message}</p>
      <div className="error-screen-actions">
        <Link to="/" className="btn btn-primary">← Back to Library</Link>
      </div>
    </div>
  );
}
