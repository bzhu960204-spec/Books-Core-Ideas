import { createContext, useContext, useState, useEffect } from 'react';

const themes = {
  'old-oak': {
    name: 'The Old Oak Library',
    icon: '📖',
    fonts: "'Playfair Display', 'Lora', serif",
    fontBody: "'Lora', serif",
    vars: {
      '--bg-primary': '#FFF8E1',
      '--bg-secondary': '#F5E6C8',
      '--bg-card': '#FFFDF5',
      '--bg-sidebar': '#3E2723',
      '--text-primary': '#3E2723',
      '--text-secondary': '#5D4037',
      '--text-on-dark': '#FFF8E1',
      '--accent': '#FFD54F',
      '--accent-hover': '#FFC107',
      '--border': '#D7CCC8',
      '--shadow': 'rgba(62, 39, 35, 0.15)',
      '--btn-primary': '#8D6E63',
      '--btn-primary-hover': '#6D4C41',
      '--btn-text': '#FFF8E1',
      '--input-bg': '#FFFDF5',
      '--input-border': '#BCAAA4',
      '--danger': '#C62828',
      '--ornament-opacity': '1',
      '--card-radius': '4px',
      '--font-heading': "'Playfair Display', serif",
      '--font-body': "'Lora', serif",
    }
  },
  'modernist': {
    name: 'The Modernist Reading Room',
    icon: '🪟',
    fonts: "'Inter', 'DM Sans', sans-serif",
    fontBody: "'DM Sans', sans-serif",
    vars: {
      '--bg-primary': '#FAFAFA',
      '--bg-secondary': '#F5F5F5',
      '--bg-card': '#FFFFFF',
      '--bg-sidebar': '#37474F',
      '--text-primary': '#212121',
      '--text-secondary': '#616161',
      '--text-on-dark': '#FAFAFA',
      '--accent': '#81C784',
      '--accent-hover': '#66BB6A',
      '--border': '#E0E0E0',
      '--shadow': 'rgba(0, 0, 0, 0.08)',
      '--btn-primary': '#37474F',
      '--btn-primary-hover': '#263238',
      '--btn-text': '#FAFAFA',
      '--input-bg': '#FFFFFF',
      '--input-border': '#BDBDBD',
      '--danger': '#EF5350',
      '--ornament-opacity': '0',
      '--card-radius': '12px',
      '--font-heading': "'Inter', sans-serif",
      '--font-body': "'DM Sans', sans-serif",
    }
  },
  'emerald': {
    name: 'The Emerald Archive',
    icon: '🏛️',
    fonts: "'Cormorant Garamond', 'Source Serif Pro', serif",
    fontBody: "'Source Serif 4', serif",
    vars: {
      '--bg-primary': '#F5F0E6',
      '--bg-secondary': '#EDE8DA',
      '--bg-card': '#FAF7F0',
      '--bg-sidebar': '#1B5E20',
      '--text-primary': '#2E2E2E',
      '--text-secondary': '#555555',
      '--text-on-dark': '#F5F0E6',
      '--accent': '#C8A96E',
      '--accent-hover': '#B8963E',
      '--border': '#D4CCBA',
      '--shadow': 'rgba(27, 94, 32, 0.12)',
      '--btn-primary': '#1B5E20',
      '--btn-primary-hover': '#145218',
      '--btn-text': '#F5F0E6',
      '--input-bg': '#FAF7F0',
      '--input-border': '#B8AD96',
      '--danger': '#B71C1C',
      '--ornament-opacity': '1',
      '--card-radius': '2px',
      '--font-heading': "'Cormorant Garamond', serif",
      '--font-body': "'Source Serif 4', serif",
    }
  },
  'midnight': {
    name: 'The Midnight Scholar',
    icon: '🌙',
    fonts: "'Merriweather', serif",
    fontBody: "'Merriweather', serif",
    vars: {
      '--bg-primary': '#1E1E2E',
      '--bg-secondary': '#252536',
      '--bg-card': '#2A2A3C',
      '--bg-sidebar': '#121212',
      '--text-primary': '#E0C097',
      '--text-secondary': '#B0A080',
      '--text-on-dark': '#E0C097',
      '--accent': '#BB86FC',
      '--accent-hover': '#A66BF5',
      '--border': '#3A3A4C',
      '--shadow': 'rgba(0, 0, 0, 0.3)',
      '--btn-primary': '#BB86FC',
      '--btn-primary-hover': '#A66BF5',
      '--btn-text': '#121212',
      '--input-bg': '#2A2A3C',
      '--input-border': '#4A4A5C',
      '--danger': '#CF6679',
      '--ornament-opacity': '0.6',
      '--card-radius': '8px',
      '--font-heading': "'Merriweather', serif",
      '--font-body': "'Merriweather', serif",
    }
  },
  'botanical': {
    name: 'The Botanical Press',
    icon: '🌿',
    fonts: "'EB Garamond', 'Libre Baskerville', serif",
    fontBody: "'Libre Baskerville', serif",
    vars: {
      '--bg-primary': '#FAF3E0',
      '--bg-secondary': '#F0E8D4',
      '--bg-card': '#FDF8EE',
      '--bg-sidebar': '#5D4037',
      '--text-primary': '#3E2723',
      '--text-secondary': '#6D4C41',
      '--text-on-dark': '#FAF3E0',
      '--accent': '#6D8B74',
      '--accent-hover': '#5A7A62',
      '--border': '#D5C9B1',
      '--shadow': 'rgba(93, 64, 55, 0.12)',
      '--btn-primary': '#6D8B74',
      '--btn-primary-hover': '#5A7A62',
      '--btn-text': '#FAF3E0',
      '--input-bg': '#FDF8EE',
      '--input-border': '#C4B899',
      '--danger': '#C06014',
      '--ornament-opacity': '1',
      '--card-radius': '6px',
      '--font-heading': "'EB Garamond', serif",
      '--font-body': "'Libre Baskerville', serif",
    }
  },
};

const ThemeContext = createContext();

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

export function useTheme() {
  return useContext(ThemeContext);
}

export { themes };
