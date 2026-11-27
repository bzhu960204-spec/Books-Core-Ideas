# JSON Import Formats

> Moved here from the root README (ENG-05). Request limits and error format: [api-conventions.md](api-conventions.md#请求体) (in Chinese).

The app supports importing data via JSON. The Library page has its own import, and each book's detail page has an **Import JSON** button for the book's structure: **Chapters** (or **Parts**, for a PARTS book).

> **One step, all or nothing:** every import is sent to the server as one request and saved in one transaction. If anything is invalid, nothing is imported and the error names the field, e.g. `books[1].chapters[0].title: must not be blank`. Unknown fields are ignored, so a book's **Export JSON** output can be imported as is.

> **Removed content:** key ideas and excerpts no longer exist (see [database-schema-and-flyway.md](database-schema-and-flyway.md), V13). Older JSON that still has `keyIdeas` / `excerpts` in its chapters imports fine; those fields are ignored. A chapter's content is its explanation, which is written in the app (or brought along by the ZIP [migration](migration-feature.md)), not by JSON import.

> **Book structure:** Each book has a `structureType` of either `"CHAPTERS"` (flat list of chapters, the default) or `"PARTS"` (chapters grouped under parts). The detail page renders and imports according to the book's structure. See [Books with Parts](#books-with-parts) below.

---

## 1. Import Book(s) — Library Page

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

**With nested chapters:**
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
      "summary": "Overview of the chapter..."
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
| `title` | string | **Yes** | Max 255 chars |
| `author` | string | No | Max 255 chars |
| `isbn` | string | No | Max 255 chars |
| `description` | string | No | Max 2000 chars |
| `coverUrl` | string | No | URL to cover image, max 255 chars |
| `rating` | integer | No | 1–5 |
| `category` | string | No | Several categories separated by `;`, max 255 chars |
| `readingStatus` | string | No | `"WANT_TO_READ"`, `"READING"`, `"FINISHED"`; `""` or `null` = not set |
| `dateAdded` | string | No | ISO date (`"2026-01-02"`); defaults to today |
| `startDate` / `finishDate` | string | No | ISO date |
| `chapterImagesEnabled` | boolean | No | Defaults to `false` |
| `structureType` | string | No | `"CHAPTERS"` (default) or `"PARTS"` |
| `chapters` | array | No | Flat chapter list (CHAPTERS books) |
| `parts` | array | No | Parts, each with nested `chapters` (PARTS books) |

> If `parts` is present (or `structureType` is `"PARTS"`), the book is created as a PARTS book. See [Books with Parts](#books-with-parts).
>
> **Limits** (enforced by the API; a longer value fails with a message naming the field): chapter and part `title` 255, part `summary` 1000. Chapter `summary` is unlimited.

---

<a id="books-with-parts"></a>
## Books with Parts (Part → Chapter)

For books organized into parts (e.g. "Part One", "Part Two"), set `structureType` to `"PARTS"` and nest chapters inside a `parts` array. Each part has its own `title`, `orderIndex`, and `summary`; chapters keep the same format as flat chapters.

This is also the exact shape produced by the book **Export** button.

```json
{
  "title": "My Book",
  "author": "Author Name",
  "structureType": "PARTS",
  "parts": [
    {
      "title": "Part One: Foundations",
      "orderIndex": 1,
      "summary": "What this part covers...",
      "chapters": [
        {
          "title": "Chapter 1: The Beginning",
          "orderIndex": 1,
          "summary": "Overview of the chapter..."
        }
      ]
    },
    {
      "title": "Part Two: Going Deeper",
      "orderIndex": 2,
      "summary": "...",
      "chapters": []
    }
  ]
}
```

On a PARTS book's detail page, the **Import JSON** button's tab is **Parts** and expects an array of parts (the `parts` value above):

```json
[
  {
    "title": "Part One: Foundations",
    "orderIndex": 1,
    "summary": "...",
    "chapters": [
      { "title": "Chapter 1", "orderIndex": 1, "summary": "..." }
    ]
  }
]
```

**Part field reference:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | **Yes** | |
| `orderIndex` | integer | No | Sort order |
| `summary` | string | No | Max 1000 chars |
| `chapters` | array | No | Chapter format (see below) |

> The importer validates structure: a `parts` payload is rejected for a CHAPTERS book, and the Chapters tab rejects objects that contain a `chapters` array (a Parts structure). In the library import, top-level `chapters` of a PARTS book (next to `parts`) become ungrouped chapters; **Export** writes a PARTS book's ungrouped chapters the same way.

---

## 2. Import Chapters — Book Detail Page → "Chapters" tab

Creates new chapters. Supports **Add New** (append) or **Replace All** (delete the book's existing parts and chapters first, with everything they own).

```json
[
  {
    "title": "Chapter 1: The Beginning",
    "orderIndex": 1,
    "summary": "Overview of the chapter..."
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
| `title` | string | **Yes** | Max 255 chars |
| `orderIndex` | integer | No | Sort order |
| `summary` | string | No | No length limit |
