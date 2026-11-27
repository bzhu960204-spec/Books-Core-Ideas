// Example JSON shown in the import dialogs of the book page.

export const CHAPTERS_JSON_HINT = `// Array of chapters:
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
]`;

export const PARTS_JSON_HINT = `// Array of parts. "chapters" is OPTIONAL — import bare
// part shells (title/orderIndex/summary) with "Add New", then drag your
// existing chapters into them. Or nest chapters to create them too:
[
  {
    "title": "Part I: Foundations",
    "orderIndex": 1,
    "summary": "Overview of part one (optional)"
  },
  {
    "title": "Part II: Application",
    "orderIndex": 2,
    "summary": "...",
    "chapters": [
      {
        "title": "Chapter 1: The Beginning",
        "orderIndex": 1,
        "summary": "..."
      }
    ]
  }
]`;
