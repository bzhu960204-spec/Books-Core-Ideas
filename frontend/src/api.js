const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';

export const bookApi = {
  getAll: () => fetch(`${API_BASE}/books`).then(r => r.json()),
  get: (id) => fetch(`${API_BASE}/books/${id}`).then(r => r.json()),
  create: (book) => fetch(`${API_BASE}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book),
  }).then(r => r.json()),
  update: (id, book) => fetch(`${API_BASE}/books/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book),
  }).then(r => r.json()),
  delete: (id) => fetch(`${API_BASE}/books/${id}`, { method: 'DELETE' }),
};

export const chapterApi = {
  getAll: (bookId) => fetch(`${API_BASE}/books/${bookId}/chapters`).then(r => r.json()),
  create: (bookId, chapter) => fetch(`${API_BASE}/books/${bookId}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chapter),
  }).then(r => r.json()),
  update: (bookId, chapterId, chapter) => fetch(`${API_BASE}/books/${bookId}/chapters/${chapterId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chapter),
  }).then(r => r.json()),
  delete: (bookId, chapterId) => fetch(`${API_BASE}/books/${bookId}/chapters/${chapterId}`, { method: 'DELETE' }),
};

export const ideaApi = {
  getAll: (chapterId) => fetch(`${API_BASE}/chapters/${chapterId}/ideas`).then(r => r.json()),
  create: (chapterId, idea) => fetch(`${API_BASE}/chapters/${chapterId}/ideas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idea),
  }).then(r => r.json()),
  update: (chapterId, ideaId, idea) => fetch(`${API_BASE}/chapters/${chapterId}/ideas/${ideaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idea),
  }).then(r => r.json()),
  delete: (chapterId, ideaId) => fetch(`${API_BASE}/chapters/${chapterId}/ideas/${ideaId}`, { method: 'DELETE' }),
};
