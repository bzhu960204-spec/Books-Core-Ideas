import { chapterImageApi } from '../../api';

// The formats the backend stores; anything else is not embedded (a second line of defence).
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const CONCURRENCY = 3;

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads a chapter's images as data URLs, in the order the backend lists them.
 * Never throws: images that can't be fetched or aren't an allowed type are counted
 * in `failed`, so the export can still go ahead without them.
 *
 * @returns {Promise<{ images: { name: string, dataUrl: string }[], failed: number }>}
 */
export async function loadExportImages(chapterId, expectedCount, api = chapterImageApi) {
  let list;
  try {
    list = await api.getAll(chapterId);
  } catch {
    return { images: [], failed: expectedCount };
  }
  if (!Array.isArray(list)) return { images: [], failed: expectedCount };

  const results = new Array(list.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      try {
        const blob = await api.getBlob(chapterId, list[i].id);
        if (!ALLOWED_TYPES.has(blob.type)) continue;
        results[i] = { name: list[i].originalName || `Image ${i + 1}`, dataUrl: await readAsDataUrl(blob) };
      } catch {
        // counted as failed below
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));

  const images = results.filter(Boolean);
  return { images, failed: list.length - images.length };
}
