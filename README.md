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

The app supports importing data via JSON in three places. All imports accept either a single object or an array of objects.

---

### 1. Import Book(s) — Library Page

Click **`{} Import JSON`** on the Library page.

**Minimal (title only required):**
```json
{
  "title": "Thinking, Fast and Slow",
  "author": "Daniel Kahneman",
  "isbn": "978-0374533557",
  "description": "A tour of the mind and the two systems that drive the way we think."
}
```

**Full — with nested chapters and key ideas:**
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
      ]
    },
    {
      "title": "Chapter 2: Going Deeper",
      "orderIndex": 2,
      "summary": "..."
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

### 2. Import Chapters — Book Detail Page

Click **`{} Import JSON`** in the Chapters section of a book's detail page.

```json
[
  {
    "title": "Chapter 1: The Beginning",
    "orderIndex": 1,
    "summary": "Overview of the chapter...",
    "keyIdeas": [
      {
        "content": "Core insight here",
        "example": "For instance...",
        "orderIndex": 1
      }
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

---

### 3. Import Key Ideas — Chapter (in Book Detail Page)

Click **`{} Import JSON`** inside a chapter to add ideas to that specific chapter.

```json
[
  {
    "content": "The main concept or insight",
    "example": "A concrete example or note",
    "orderIndex": 1
  },
  {
    "content": "Another important idea",
    "example": "Supporting detail...",
    "orderIndex": 2
  }
]
```

**Field reference:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | **Yes** | Max 3000 chars |
| `example` | string | No | Max 3000 chars |
| `orderIndex` | integer | No | Sort order |

---

## Tech Stack

- **Backend:** Java 17, Spring Boot 3, Spring Data JPA, H2 (file-based)
- **Frontend:** React 18, Vite, React Router
- **Database file:** `backend/data/booksdb.mv.db` (local, not committed to git)
