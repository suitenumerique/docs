import { CunninghamProvider } from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useLayoutEffect } from 'react';

import { getStoredThemeMode, useCunninghamTheme } from '@/cunningham';
import { useLocales } from '@/i18n/useLocale';

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setThemeMode, applyThemeMode } = useCunninghamTheme();
  const currentLocale = useLocales();

  // Apply the persisted colour-mode on mount. The store starts from a stable
  // default (for SSR/hydration parity); this reconciles it to the user's choice
  // before paint, matching what the _document.tsx inline script already painted.
  // With no explicit preference we resolve `system` in memory only (no persist),
  // so a backend brand theme (e.g. `dsfr`) can still be applied by ConfigProvider.
  useIsomorphicLayoutEffect(() => {
    const stored = getStoredThemeMode();
    if (stored) {
      setThemeMode(stored);
    } else {
      applyThemeMode('system');
    }
  }, [setThemeMode, applyThemeMode]);

  // While in `system` mode, follow live changes to the OS colour scheme, but
  // never override a non-default brand theme applied from backend config.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const state = useCunninghamTheme.getState();
      if (
        state.themeMode === 'system' &&
        (state.theme === 'default' || state.theme === 'dark')
      ) {
        state.applyThemeMode('system');
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return (
    <CunninghamProvider theme={theme} currentLocale={currentLocale}>
      {children}
    </CunninghamProvider>
  );
}
