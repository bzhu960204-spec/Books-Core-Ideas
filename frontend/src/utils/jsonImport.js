// Builds the bodies of the JSON import endpoints (FE-08) from what the user pasted.
// The server validates fields and imports each request in one transaction; here we
// only reshape the JSON and reject shapes the server cannot tell apart.

const asArray = (parsed) => (Array.isArray(parsed) ? parsed : [parsed]);
const apiMode = (mode) => (mode === 'replace' ? 'REPLACE' : 'ADD');

function requireObjects(items, what) {
  if (items.some(item => item === null || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(`Each ${what} must be a JSON object.`);
  }
}

/** Library "Import JSON": a book or an array of books, with nested chapters / parts. */
export function bookImport(parsed) {
  const books = asArray(parsed);
  requireObjects(books, 'book');
  return { books };
}

/** Book page "Chapters" (flat books) or "Parts" tab. */
export function structureImport(parsed, mode, isPartsBook) {
  const items = asArray(parsed);
  requireObjects(items, isPartsBook ? 'part' : 'chapter');
  if (isPartsBook) return { mode: apiMode(mode), parts: items };
  // A chapter's nested "chapters" would be ignored by the server, so catch it here.
  if (items.some(item => Array.isArray(item.chapters))) {
    throw new Error('This looks like a Parts structure (objects contain a "chapters" array). This book uses the Chapters structure — switch the book to "Parts → Chapters" first, or import a flat chapters array.');
  }
  return { mode: apiMode(mode), chapters: items };
}
