import merge from 'lodash/merge';
import { create } from 'zustand';

import { tokens } from './cunningham-tokens';

type Tokens = typeof tokens.themes.default &
  Partial<(typeof tokens.themes)[keyof typeof tokens.themes]>;
type ColorsTokens = Tokens['globals']['colors'];
type FontSizesTokens = Tokens['globals']['font']['sizes'];
type SpacingsTokens = Tokens['globals']['spacings'];
type ComponentTokens = Tokens['components'];
type ContextualTokens = Tokens['contextuals'];
export type Theme = keyof typeof tokens.themes;

/**
 * User-facing colour mode. `system` follows the OS `prefers-color-scheme`.
 * It maps onto the underlying Cunningham theme: light -> `default`, dark -> `dark`.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODE_STORAGE_KEY = 'doc-theme-mode';

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';

/** The persisted colour-mode preference, or null if never set / unavailable. */
export const getStoredThemeMode = (): ThemeMode | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const value = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
};

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolveTheme = (mode: ThemeMode): Theme => {
  if (mode === 'system') {
    return systemPrefersDark() ? 'dark' : 'default';
  }
  return mode === 'dark' ? 'dark' : 'default';
};

interface ThemeStore {
  colorsTokens: Partial<ColorsTokens>;
  componentTokens: ComponentTokens;
  contextualTokens: ContextualTokens;
  currentTokens: Partial<Tokens>;
  fontSizesTokens: Partial<FontSizesTokens>;
  setTheme: (theme: Theme) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  applyThemeMode: (mode: ThemeMode) => void;
  spacingsTokens: Partial<SpacingsTokens>;
  theme: Theme;
  themeTokens: Partial<Tokens['globals']>;
}

const getMergedTokens = (theme: Theme) => {
  return merge({}, tokens.themes['default'], tokens.themes[theme]);
};

/** All token slices derived from a resolved Cunningham theme. */
const tokenSlices = (theme: Theme) => {
  const merged = getMergedTokens(theme);
  return {
    colorsTokens: merged.globals.colors,
    componentTokens: merged.components,
    contextualTokens: merged.contextuals,
    currentTokens: tokens.themes[theme] as Partial<Tokens>,
    fontSizesTokens: merged.globals.font.sizes,
    spacingsTokens: merged.globals.spacings,
    theme,
    themeTokens: merged.globals,
  };
};

// The store initialises to a stable default on both server and client so SSR
// output and the first client render match. The real preference is read from
// localStorage and applied on mount by ThemeProvider (and painted pre-hydration
// by the inline script in _document.tsx), so there is no flash of the wrong theme.
const DEFAULT_MODE: ThemeMode = 'system';
const DEFAULT_THEME: Theme = 'default';

export const useCunninghamTheme = create<ThemeStore>((set) => ({
  ...tokenSlices(DEFAULT_THEME),
  themeMode: DEFAULT_MODE,
  setTheme: (theme: Theme) => {
    set(tokenSlices(theme));
  },
  // Resolve and apply a mode WITHOUT persisting it. Used for the in-memory
  // default so an unset preference does not get written to localStorage and
  // mask a backend brand theme.
  applyThemeMode: (mode: ThemeMode) => {
    set({ ...tokenSlices(resolveTheme(mode)), themeMode: mode });
  },
  setThemeMode: (mode: ThemeMode) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
      } catch {
        // ignore write failures (private mode, storage disabled)
      }
    }
    set({ ...tokenSlices(resolveTheme(mode)), themeMode: mode });
  },
}));
