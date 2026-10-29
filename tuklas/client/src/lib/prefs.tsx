/** Theme (light, dark or follow the system) and look (Modern or Classic), saved in this browser. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type Appearance = 'modern' | 'classic';
interface Prefs {
  theme: Theme;
  appearance: Appearance;
}

const KEY = 'tuklas.prefs.v1';
const defaults: Prefs = { theme: 'system', appearance: 'modern' };

function load(): Prefs {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

interface PrefsValue {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  /** The theme on screen right now, with 'system' resolved */
  resolvedTheme: 'light' | 'dark';
}

const PrefsContext = createContext<PrefsValue | null>(null);
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Look and theme are per-viewer conveniences, so they live in the browser, not the DB. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState(load);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);
  const resolvedTheme = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = prefs.appearance;
    root.dataset.theme = resolvedTheme;
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* private mode: prefs just won't persist */
    }
  }, [prefs, resolvedTheme]);

  // Follow the operating system while the theme is set to Auto.
  useEffect(() => {
    const media = darkQuery();
    const follow = () => setSystemDark(media.matches);
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);

  return (
    <PrefsContext.Provider value={{ prefs, setPrefs: (p) => setState((s) => ({ ...s, ...p })), resolvedTheme }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}
