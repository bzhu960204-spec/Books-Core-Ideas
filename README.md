# Books Core Ideas

A full-stack web app for organizing books, chapters, and key ideas. Built with Spring Boot (backend) + React/Vite (frontend).

## Quick Start

```bash
# Windows — start both backend and frontend
start-dev.cmd
# or PowerShell
.\start-dev.ps1
```

Backend runs on `http://localhost:8080`, frontend on `http://localhost:5173`.

---

## JSON Import Formats

The app supports importing data via JSON. Library page has its own import, and each book's detail page has a unified **Import JSON** button with three tabs: **Chapters**, **Ideas**, **Excerpts**.

---

### 1. Import Book(s) — Library Page

Click **`Import JSON`** on the Library page.

**Minimal (title only required):**
```json
{
  "title": "Thinking, Fast and Slow",
  "author": "Daniel Kahneman",
  "isbn": "978-0374533557",
  "description": "A tour of the mind and the two systems that drive the way we think."
}
```

**Full — with nested chapters, key ideas, and excerpts:**
```json
{
  "title": "My Book",
  "author": "Author Name",
  "isbn": "978-xxxxxxxxxx",
  "description": "Brief description...",
  "chapters": [
    {
      "title": "Chapter 1: The Beginning",
      "orderIndex": 1,
      "summary": "Overview of the chapter...",
      "keyIdeas": [
        {
          "content": "Core insight or concept",
          "example": "A concrete example or supporting note",
          "orderIndex": 1
        }
      ],
      "excerpts": [
        {
          "content": "A memorable passage...",
          "note": "Why it matters",
          "source": "p.42",
          "orderIndex": 1
        }
      ]
    }
  ]
}
```

**Array of books:**
```json
[
  { "title": "Book One", "author": "Alice" },
  { "title": "Book Two", "author": "Bob" }
]
```

**Field reference:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | **Yes** | |
| `author` | string | No | |
| `isbn` | string | No | |
| `description` | string | No | Max 2000 chars |
| `coverUrl` | string | No | URL to cover image |
| `chapters` | array | No | See Chapter format below |

---

### 2. Import Chapters — Book Detail Page → "Chapters" tab

Creates new chapters. Can include nested `keyIdeas` and `excerpts`.

```json
[
  {
    "title": "Chapter 1: The Beginning",
    "orderIndex": 1,
    "summary": "Overview of the chapter...",
    "keyIdeas": [
      { "content": "Core insight here", "example": "For instance...", "orderIndex": 1 }
    ],
    "excerpts": [
      { "content": "A memorable passage...", "note": "Why it matters", "orderIndex": 1 }
    ]
  },
  {
    "title": "Chapter 2: Going Deeper",
    "orderIndex": 2,
    "summary": "..."
  }
]
```

**Field reference:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | **Yes** | |
| `orderIndex` | integer | No | Sort order |
| `summary` | string | No | Max 1000 chars |
| `keyIdeas` | array | No | See Key Idea format below |
| `excerpts` | array | No | See Excerpt format below |

---

### 3. Import Key Ideas — Book Detail Page → "Ideas (All)" tab

Import ideas into **existing** chapters across the whole book. Group by chapter title (fuzzy match).

Supports **Add New** (append) or **Replace All** (clear existing ideas first).

```json
[
  {
    "chapter": "Chapter 1: The Beginning",
    "ideas": [
      { "content": "Core insight", "example": "For instance...", "orderIndex": 1 },
      { "content": "Another idea", "orderIndex": 2 }
    ]
  },
  {
    "chapter": "Chapter 2: Going Deeper",
    "ideas": [
      { "content": "Key concept", "orderIndex": 1 }
    ]
  }
]
```

**Field reference (per idea):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | **Yes** | Max 3000 chars |
| `example` | string | No | Max 3000 chars |
| `tags` | string | No | Comma-separated |
| `orderIndex` | integer | No | Sort order |

---

### 4. Import for Single Chapter (⬇ button on chapter header)

Click the **⬇** button on any chapter header. A modal opens with three tabs:

**Tab: Ideas** — flat array, imports into this chapter only.

```json
[
  { "content": "Core insight", "example": "For instance...", "orderIndex": 1 },
  { "content": "Another idea", "orderIndex": 2 }
]
```

**Tab: Excerpts** — flat array, imports into this chapter only.

```json
[
  {
    "content": "The full passage. **Markdown** supported.",
    "note": "Why it stands out (optional)",
    "source": "p.42 (optional)",
    "orderIndex": 1
  },
  { "content": "Another memorable passage...", "orderIndex": 2 }
]
```

**Tab: Ideas + Excerpts** — import both at once in a single object.

```json
{
  "ideas": [
    { "content": "Core insight", "example": "For instance...", "orderIndex": 1 },
    { "content": "Another idea", "orderIndex": 2 }
  ],
  "excerpts": [
    {
      "content": "A memorable passage. **Markdown** supported.",
      "note": "Why it stands out (optional)",
      "source": "p.42 (optional)",
      "orderIndex": 1
    }
  ]
}
```

All three tabs support **Add New** or **Replace All**.

---

### 5. Import Excerpts — Book Detail Page → "Excerpts (All)" tab

Import excerpts into **existing** chapters across the whole book. Group by chapter title (fuzzy match).

Supports **Add New** (append) or **Replace All** (clear existing excerpts first).

```json
[
  {
    "chapter": "Chapter 1: The Beginning",
    "excerpts": [
      {
        "content": "The full passage text. **Markdown** supported.",
        "note": "Why this passage stands out (optional)",
        "source": "p.42 (optional)",
        "orderIndex": 1
      }
    ]
  },
  {
    "chapter": "Chapter 2: Going Deeper",
    "excerpts": [
      { "content": "Another memorable passage...", "orderIndex": 1 }
    ]
  }
]
```

**Field reference (per excerpt):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | **Yes** | Markdown supported |
| `note` | string | No | Personal annotation, max 1000 chars |
| `source` | string | No | Page / section reference, max 300 chars |
| `orderIndex` | integer | No | Sort order |

> Once imported, click the **📖 N** badge on the chapter header to open the full-screen excerpt reader with ←/→ navigation.

---

## Tech Stack

- **Backend:** Java 17, Spring Boot 3, Spring Data JPA, H2 (file-based)
- **Frontend:** React 18, Vite, React Router
- **Database file:** `backend/data/booksdb.mv.db` (local, not committed to git)
