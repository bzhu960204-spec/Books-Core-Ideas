import { useState, useEffect } from 'react';
import { themes } from './themes';
import { ThemeContext } from './useTheme';

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    return localStorage.getItem('book-app-theme') || 'old-oak';
  });

  useEffect(() => {
    const theme = themes[themeKey];
    if (!theme) return;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    localStorage.setItem('book-app-theme', themeKey);
  }, [themeKey]);

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, theme: themes[themeKey], themes }}>
      {children}
    </ThemeContext.Provider>
  );
}
