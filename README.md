# Books Core Ideas

A personal reading journal: organise books into chapters (optionally grouped into parts), and keep the key ideas, excerpts, AI explanations and your own reviews for each one. Spring Boot backend, React/Vite frontend, data in a local H2 file. It runs on your own machine and accepts connections from this machine only (there is no login).

## Features

- **Library**: grid, list and compact views; search; filter by rating, category and reading status; set the status straight from a book's card.
- **Books**: a flat chapter list or Parts → Chapters. Per chapter:
  - key ideas (tags, highlights) and excerpts, with a full-screen excerpt reader;
  - chapter images (PNG/JPEG/GIF/WebP), if enabled for the book;
  - a rich-text **explanation**: paste from Markdown or AI chats, read full screen, mark where you stopped (a reading bookmark), and save passages with notes. Explanations can be exported as HTML or print-to-PDF.
- **Collections**: nested folders of books.
- **Idea Bank / Excerpt Bank**: search all ideas (by book and tag) and all excerpts (by book).
- **Review Bank**: your rich-text reviews of books.
- **Reading History**: where you left off in each book's explanations.
- **Import / export**:
  - JSON import into the library, a book, or a chapter (format: [doc/json-import-format.md](doc/json-import-format.md)), and each book's **Export JSON**;
  - **Migrate**: ZIP export / import of whole books with everything they own, to move them between installations ([doc/migration-feature.md](doc/migration-feature.md)).
- Five themes.

## Quick Start

First time on a machine:

```powershell
cd frontend; npm ci; cd ..        # frontend dependencies (Node version: see Requirements)
.\setup-data-link.ps1             # optional: keep backend\data in OneDrive (see Data & Backup)
```

**Development** (backend with hot restart + Vite dev server):

```powershell
start-dev.cmd                     # or, in PowerShell: .\start-dev.ps1
```

The backend runs on `http://localhost:8080` and the frontend on `http://localhost:5173`; open the frontend. If a port is taken, the script picks the next free one and says so. It reports "Both services started" once the backend's `/actuator/health` is UP and Vite answers. Stop with Ctrl+C, or from another console with `.\stop-dev.ps1`: it stops exactly what start-dev started, whatever ports it ended up on.

**Everyday use** (single port, packaged):

```powershell
start-prod.cmd                    # builds on first run (or with -Rebuild), then opens the browser
.\stop-prod.ps1
```

One Spring Boot process serves the API and the built frontend on `http://localhost:8080` (or the next free port). Logs go to the console and to `logs\prod-<timestamp>.log`. After changing code, rebuild with `.\build-prod.ps1` or `start-prod.cmd -Rebuild`.

The H2 Console (`/h2-console`) is only available in development. Both modes use the same database, so run only one at a time; the second refuses to start.

## Requirements

- **JDK 17+.** Maven is not needed: `backend\mvnw.cmd` (the Maven Wrapper) downloads the pinned version. If `JAVA_HOME` points to an older JDK, put the path of a JDK 17+ in a `.java-home` file in the repository root; the start and build scripts use it.
- **Node.js 22.13+ / 24 / 26+** (`frontend/.nvmrc` pins 24). `npm install` / `npm ci` refuse other versions.
- Windows PowerShell 5.1 or later (the scripts are PowerShell).

## Data & Backup

Data lives in `backend\data\` (H2 database `booksdb.mv.db` + uploaded images) and is not in git. `setup-data-link.ps1` turns `backend\data` into a junction to `<OneDrive>\ProjectData\books-core-ideas\data`, so the data follows you between machines. Never run the app on two machines at once: close it and let OneDrive finish syncing first.

The schema is managed by Flyway: after an update, the next start migrates the database ([doc/database-schema-and-flyway.md](doc/database-schema-and-flyway.md)). Take a snapshot before updates and other risky changes. Stop the app first; both scripts refuse to run while a process has the database open. A `booksdb.lock.db` left behind by an older version of the app is recognised as stale and ignored with a warning (`-Force` is accepted but no longer needed).

```powershell
.\stop-dev.ps1
.\backup-data.ps1 -Label before-refactor      # -> backups\data-<timestamp>-before-refactor.zip
.\restore-data.ps1 -Latest                    # or -BackupFile .\backups\<file>.zip
```

`restore-data.ps1` first saves the current data as `*-pre-restore.zip`, so you can undo a restore. `backups\` is git-ignored.

## Tests & CI

```powershell
cd backend;  .\mvnw.cmd test        # integration tests on an isolated in-memory H2 (never touches backend\data)
cd frontend; npm.cmd test; npm.cmd run lint; npm.cmd run build   # Vitest (jsdom); lint fails on any warning
powershell -NoProfile -File tools\tests\data-scripts.test.ps1   # backup / restore scripts
powershell -NoProfile -File tools\tests\app-run.test.ps1        # helpers of the start / stop scripts
```

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the backend and frontend checks on every push to `main` and on pull requests; Dependabot keeps dependencies up to date.

## Documentation

[doc/README.md](doc/README.md) lists all documents (most are in Chinese). Start with:

- [doc/development-workflow.md](doc/development-workflow.md): conventions for changing the code (data safety, migrations, tests, checking a change against a copy of the real data);
- [doc/api-conventions.md](doc/api-conventions.md): status codes, error format, request bodies;
- [doc/json-import-format.md](doc/json-import-format.md): JSON import formats.

## Tech Stack

- **Backend:** Java 17+, Spring Boot 4.1 (Spring MVC, Spring Data JPA / Hibernate 7, Bean Validation, Actuator), Jackson 3, Flyway, H2 2.4 (file-based)
- **Frontend:** React 19, Vite 8, React Router 7, TanStack Query 5, TipTap 3 (rich text), DOMPurify, marked, JSZip; Vitest + Testing Library, ESLint