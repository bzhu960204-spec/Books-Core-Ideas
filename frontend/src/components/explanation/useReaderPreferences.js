import { useEffect, useState } from 'react';

// Adjustable reading font scale bounds (persisted in localStorage).
const FONT_MIN = 0.85;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;
const FONT_KEY = 'explanationReaderFontScale';
const HIGHLIGHTS_KEY = 'explanationReaderShowHighlights';

/** The reader's font scale and whether saved passages are highlighted, remembered across sessions. */
export function useReaderPreferences() {
  const [fontScale, setFontScale] = useState(() => {
    const saved = parseFloat(localStorage.getItem(FONT_KEY));
    return Number.isFinite(saved) ? Math.min(FONT_MAX, Math.max(FONT_MIN, saved)) : 1;
  });

  const [showHighlights, setShowHighlights] = useState(() => localStorage.getItem(HIGHLIGHTS_KEY) !== 'off');

  useEffect(() => {
    try { localStorage.setItem(FONT_KEY, String(fontScale)); } catch { /* ignore */ }
  }, [fontScale]);

  useEffect(() => {
    try { localStorage.setItem(HIGHLIGHTS_KEY, showHighlights ? 'on' : 'off'); } catch { /* ignore */ }
  }, [showHighlights]);

  return {
    fontScale,
    canShrinkFont: fontScale > FONT_MIN,
    canGrowFont: fontScale < FONT_MAX,
    shrinkFont: () => setFontScale(s => Math.max(FONT_MIN, +(s - FONT_STEP).toFixed(2))),
    growFont: () => setFontScale(s => Math.min(FONT_MAX, +(s + FONT_STEP).toFixed(2))),
    showHighlights,
    toggleHighlights: () => setShowHighlights(v => !v),
  };
}
