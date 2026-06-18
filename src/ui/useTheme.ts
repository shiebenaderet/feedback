import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/** localStorage key the chosen theme is persisted under. */
export const THEME_STORAGE_KEY = 'feedback-theme';

/** Dark is the default; only 'light' is ever stored / set as an attribute. */
function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Reflect the theme onto <html>: light sets data-theme="light", dark removes it. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
}

/**
 * Reads the persisted theme on mount, applies it to <html>, and exposes a
 * toggle that flips, persists, and re-applies. Dark stays the default.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore unavailable storage */
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
