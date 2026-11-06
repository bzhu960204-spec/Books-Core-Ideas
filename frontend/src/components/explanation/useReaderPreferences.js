import { useEffect, useState } from 'react';

// Adjustable reading font scale bounds (persisted in localStorage).
const FONT_MIN = 0.85;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;
const FONT_KEY = 'explanationReaderFontScale';
const HIGHLIGHTS_KEY = 'explanationReaderShowHighlights';
const IMAGE_PANEL_KEY = 'explanationReaderImagePanel';
const IMAGE_RATIO_KEY = 'explanationReaderImagePanelRatio';
const IMAGE_RATIO_MIN = 0.25;
const IMAGE_RATIO_MAX = 0.65;
const IMAGE_RATIO_DEFAULT = 0.4;

const clampRatio = (r) => Math.min(IMAGE_RATIO_MAX, Math.max(IMAGE_RATIO_MIN, r));

/** The reader's font scale, highlight switch and image side panel, remembered across sessions. */
export function useReaderPreferences() {
  const [fontScale, setFontScale] = useState(() => {
    const saved = parseFloat(localStorage.getItem(FONT_KEY));
    return Number.isFinite(saved) ? Math.min(FONT_MAX, Math.max(FONT_MIN, saved)) : 1;
  });

  const [showHighlights, setShowHighlights] = useState(() => localStorage.getItem(HIGHLIGHTS_KEY) !== 'off');

  const [imagePanelOpen, setImagePanelOpen] = useState(() => localStorage.getItem(IMAGE_PANEL_KEY) === 'on');
  const [imagePanelRatio, setImagePanelRatioState] = useState(() => {
    const saved = parseFloat(localStorage.getItem(IMAGE_RATIO_KEY));
    return Number.isFinite(saved) ? clampRatio(saved) : IMAGE_RATIO_DEFAULT;
  });

  useEffect(() => {
    try { localStorage.setItem(FONT_KEY, String(fontScale)); } catch { /* ignore */ }
  }, [fontScale]);

  useEffect(() => {
    try { localStorage.setItem(HIGHLIGHTS_KEY, showHighlights ? 'on' : 'off'); } catch { /* ignore */ }
  }, [showHighlights]);

  useEffect(() => {
    try { localStorage.setItem(IMAGE_PANEL_KEY, imagePanelOpen ? 'on' : 'off'); } catch { /* ignore */ }
  }, [imagePanelOpen]);

  useEffect(() => {
    try { localStorage.setItem(IMAGE_RATIO_KEY, String(imagePanelRatio)); } catch { /* ignore */ }
  }, [imagePanelRatio]);

  return {
    fontScale,
    canShrinkFont: fontScale > FONT_MIN,
    canGrowFont: fontScale < FONT_MAX,
    shrinkFont: () => setFontScale(s => Math.max(FONT_MIN, +(s - FONT_STEP).toFixed(2))),
    growFont: () => setFontScale(s => Math.min(FONT_MAX, +(s + FONT_STEP).toFixed(2))),
    showHighlights,
    toggleHighlights: () => setShowHighlights(v => !v),
    imagePanelOpen,
    toggleImagePanel: () => setImagePanelOpen(v => !v),
    imagePanelRatio,
    setImagePanelRatio: (ratio) => setImagePanelRatioState(clampRatio(ratio)),
  };
}
