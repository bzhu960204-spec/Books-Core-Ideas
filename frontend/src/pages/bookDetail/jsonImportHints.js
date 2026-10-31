// Example JSON shown in the import dialogs of the book page.

export const CHAPTERS_JSON_HINT = `// Array of chapters (keyIdeas & excerpts optional):
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
        "summary": "...",
        "keyIdeas": [
          { "content": "Core insight", "example": "...", "orderIndex": 1 }
        ],
        "excerpts": [
          { "content": "A memorable passage...", "note": "Why it matters", "orderIndex": 1 }
        ]
      }
    ]
  }
]`;

export const IDEAS_JSON_HINT = `// Group ideas by chapter title:
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
]`;

export const EXCERPTS_JSON_HINT = `// Group excerpts by chapter title:
[
  {
    "chapter": "Chapter 1: The Beginning",
    "excerpts": [
      {
        "content": "The full passage text. **Markdown** supported.",
        "note": "Why this stands out (optional)",
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
]`;

export const CHAPTER_IDEAS_HINT = `// Array of ideas for this chapter:
[
  { "content": "Core insight", "example": "For instance...", "orderIndex": 1 },
  { "content": "Another idea", "orderIndex": 2 }
]`;

export const CHAPTER_EXCERPTS_HINT = `// Array of excerpts for this chapter:
[
  {
    "content": "The full passage. **Markdown** supported.",
    "note": "Why it stands out (optional)",
    "source": "p.42 (optional)",
    "orderIndex": 1
  },
  { "content": "Another memorable passage...", "orderIndex": 2 }
]`;

export const CHAPTER_COMBINED_HINT = `// Import ideas AND excerpts together:
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
}`;
