import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../ThemeContext';

// Representative accent color for each theme swatch
const SWATCH_COLORS = {
  'old-oak':   { bg: '#3E2723', dot: '#FFD54F' },
  'modernist': { bg: '#37474F', dot: '#81C784' },
  'emerald':   { bg: '#1B5E20', dot: '#C8A96E' },
  'midnight':  { bg: '#1E1E2E', dot: '#BB86FC' },
  'botanical': { bg: '#5D4037', dot: '#6D8B74' },
};

export default function ThemeSwitcher() {
  const { themeKey, setThemeKey, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="ts-wrapper" ref={ref}>
      <button
        className="ts-trigger"
        onClick={() => setOpen(o => !o)}
        title={`Theme: ${themes[themeKey].name}`}
      >
        <span className="ts-trigger-dot" style={{ background: SWATCH_COLORS[themeKey].dot }} />
        <span className="ts-trigger-label">Theme</span>
        <span className="ts-trigger-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="ts-panel">
          <div className="ts-panel-title">Choose a theme</div>
          <div className="ts-swatches">
            {Object.entries(themes).map(([key, t]) => {
              const colors = SWATCH_COLORS[key];
              return (
                <button
                  key={key}
                  className={`ts-swatch ${key === themeKey ? 'ts-swatch-active' : ''}`}
                  style={{ background: colors.bg }}
                  onClick={() => { setThemeKey(key); setOpen(false); }}
                  title={t.name}
                >
                  <span className="ts-swatch-dot" style={{ background: colors.dot }} />
                  <span className="ts-swatch-name">{t.icon} {t.name}</span>
                  {key === themeKey && <span className="ts-swatch-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
