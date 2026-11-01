# Frontend

React 19 + Vite. How to run the whole app, requirements and tests: see the [root README](../README.md); conventions: [doc/development-workflow.md](../doc/development-workflow.md).

```powershell
npm ci                  # Node version: package.json "engines" / .nvmrc (engine-strict)
npm run dev             # Vite on :5173, /api proxied to VITE_API_PROXY_TARGET (default http://127.0.0.1:8080)
npm test                # Vitest + Testing Library (jsdom)
npm run lint            # ESLint, fails on any warning
npm run build           # -> dist/, served by the backend in single-port (prod) mode
```

In PowerShell scripts, call `npm.cmd` / `npx.cmd`: `npm` resolves to `npm.ps1`, which the execution policy may refuse to run.

## Layout

| Path | Contents |
|---|---|
| `src/api.js` | Every backend call (one `request()` helper; errors carry the ProblemDetail `detail` and the HTTP status) |
| `src/queries.js` | TanStack Query hooks and cache keys; writes invalidate the cache |
| `src/pages/` | One component per route; `pages/bookDetail/` holds the book page's hooks and parts |
| `src/components/` | Shared components; `richText/` (TipTap editor and paste handling), `explanation/` (explanation reader), `collections/`, `feedback/` (toasts, error boundary) |
| `src/utils/` | Pure helpers: HTML sanitising (DOMPurify), JSON import shapes, explanation anchors, dates, … |
| `src/styles/` | CSS, one file per area, imported in order by `index.css` |
| `src/test/` | Test setup and the fake backend (`installFakeBackend`) used by page tests |

Heavy pages and the editor are lazy-loaded (`chunkReload.js` reloads once if an old chunk has gone after a deploy).