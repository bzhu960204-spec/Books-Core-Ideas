// Compares the UI of two frontend versions served side by side (FE-01).
// Run as a Playwright snippet with a `page` in scope (e.g. the VS Code browser's
// "run Playwright code"): it returns the scenarios whose DOM or screenshots differ.
// Not a module: the top-level await / return belong to the snippet runner.
//
// Setup (see doc/development-workflow.md, section 4): a backend on a copy of the
// real data (18084), the version before the change in a git worktree served by
// Vite on 15174, the working tree on 15173, both proxying to 18084.
//
// Per theme and scenario it records
// - a DOM signature of <body>: every element with its attributes and every text
//   node separately (innerHTML would hide merged/split text nodes, which shift
//   glyphs by sub-pixels), without Vite's ?t= reload stamps;
// - a hash of each 900px screen while scrolling the window (full-page screenshots
//   in the VS Code browser re-layout the page at another width, so they are not used).
// The scenarios use books of the real data: 551 (parts, explanations, bookmark),
// 97 (excerpts), 388 (67 chapters in parts), 195 (chapter images). Library covers
// are external images: a mismatch there that goes away on a re-run is load timing.
const OLD = 'http://localhost:15174';
const NEW = 'http://localhost:15173';
const THEMES = ['old-oak', 'modernist', 'emerald', 'midnight', 'botanical'];
const fnv = (buf) => { let h = 2166136261 >>> 0; for (const b of buf) { h ^= b; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
const settle = async (ms = 400) => {
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
  await page.mouse.move(1, 1);
};
const mk = (BASE) => {
  const go = async (path, sel) => { await page.goto(BASE + path); await page.waitForSelector(sel, { timeout: 20000 }); await settle(); };
  const click = async (sel, nth = 0) => { await page.locator(sel).nth(nth).click(); await settle(); };
  return {
    libGrid: async () => { await page.evaluate(() => localStorage.setItem('library-view', 'grid')); await go('/', '.book-card, .book-list-item, .book-compact-row'); },
    libList: async () => { await page.evaluate(() => localStorage.setItem('library-view', 'list')); await go('/', '.main-content'); await page.waitForTimeout(800); await settle(); },
    libCompact: async () => { await page.evaluate(() => localStorage.setItem('library-view', 'compact')); await go('/', '.main-content'); await page.waitForTimeout(800); await settle(); },
    parts: async () => { await go('/book/551', '.part-item'); },
    partsExpanded: async () => { await go('/book/551', '.part-item'); await click('.chapter-header'); await page.waitForTimeout(1200); },
    reader: async () => { await go('/book/551', '.part-item'); await click('button[title="View / edit explanation"]'); await page.waitForSelector('.review-reader-content'); await settle(600); },
    editor: async () => { await go('/book/551', '.part-item'); await click('button[title="View / edit explanation"]'); await page.waitForSelector('.review-reader-content'); await click('button:has-text("Edit")'); await page.waitForSelector('.rte-toolbar'); await click('button[title="More formatting"]'); },
    excerpts: async () => { await go('/book/97', '.chapter-item'); await click('button[title="Read excerpts"]'); },
    bigParts: async () => { await go('/book/388', '.part-item'); await click('.part-toggle'); },
    images: async () => { await go('/book/195', '.chapter-item'); await click('.chapter-header', 1); await page.waitForTimeout(1200); },
    passages: async () => { await go('/book/551', '.part-item'); await click('button:has-text("Saved Passages")'); },
    importModal: async () => { await go('/book/551', '.part-item'); await click('button:has-text("Import JSON")'); },
    chapterImport: async () => { await go('/book/97', '.chapter-item'); await click('button[title="Import JSON for this chapter"]'); },
    ideas: async () => { await go('/ideas', '.main-content'); await page.waitForTimeout(1000); await settle(); },
    excerptBank: async () => { await go('/excerpts', '.main-content'); await page.waitForTimeout(1000); await settle(); },
    reviews: async () => { await go('/reviews', '.main-content'); await page.waitForTimeout(1000); await settle(); },
    history: async () => { await go('/history', '.main-content'); await page.waitForTimeout(1000); await settle(); },
    collections: async () => { await go('/collections', '.main-content'); await page.waitForTimeout(1000); await settle(); },
  };
};
const MODAL = new Set(['reader', 'editor', 'excerpts', 'passages', 'importModal', 'chapterImport']);
const capture = async (BASE, theme, name) => {
  await page.goto(BASE + '/history');
  await page.evaluate(t => { localStorage.clear(); localStorage.setItem('book-app-theme', t); }, theme);
  await mk(BASE)[name]();
  const dom = await page.evaluate(async () => {
    const parts = [];
    const walk = (n) => {
      if (n.nodeType === 3) parts.push('T:' + n.nodeValue);
      else if (n.nodeType === 1) { parts.push('<' + n.tagName + [...n.attributes].map(a => ' ' + a.name + '=' + a.value).join('')); for (const c of n.childNodes) walk(c); parts.push('>'); }
    };
    walk(document.body);
    const s = parts.join('\u0001').replace(/\?t=\d+/g, '');
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(d)].slice(0, 6).map(x => x.toString(16).padStart(2, '0')).join('');
  });
  const shots = [];
  if (MODAL.has(name)) shots.push(fnv(await page.screenshot({ animations: 'disabled' })));
  else {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Math.min(h, 9000); y += 900) {
      await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(150); await page.mouse.move(1, 1);
      shots.push(fnv(await page.screenshot({ animations: 'disabled' })));
    }
  }
  return { dom, shots: shots.join(',') };
};
await page.setViewportSize({ width: 1400, height: 900 });
const out = {};
let screens = 0;
for (const theme of THEMES) for (const name of Object.keys(mk(''))) {
  const a = await capture(OLD, theme, name);
  const b = await capture(NEW, theme, name);
  screens += a.shots.split(',').length;
  const ok = a.dom === b.dom && a.shots === b.shots;
  if (!ok) out[`${theme}/${name}`] = (a.dom === b.dom ? 'dom=' : 'DOM!') + ' ' + (a.shots === b.shots ? 'shots=' : `SHOTS! ${a.shots} | ${b.shots}`);
}
return '@@' + JSON.stringify({ themes: THEMES, scenarios: Object.keys(mk('')).length, screens, mismatches: out }) + '@@';