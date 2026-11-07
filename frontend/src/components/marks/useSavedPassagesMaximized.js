import { useEffect, useState } from 'react';

const KEY = 'savedPassagesMaximized';

const read = () => {
  try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
};

/** Whether the Saved Passages dialog is maximized, remembered across sessions. */
export function useSavedPassagesMaximized() {
  const [maximized, setMaximized] = useState(read);

  useEffect(() => {
    try { localStorage.setItem(KEY, maximized ? 'on' : 'off'); } catch { /* ignore */ }
  }, [maximized]);

  return [maximized, setMaximized];
}
