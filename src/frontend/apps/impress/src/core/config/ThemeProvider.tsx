import { CunninghamProvider } from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useLayoutEffect } from 'react';

import { getStoredThemeMode, useCunninghamTheme } from '@/cunningham';
import { useLocales } from '@/i18n/useLocale';

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setThemeMode } = useCunninghamTheme();
  const currentLocale = useLocales();

  // Apply the persisted colour-mode on mount. The store starts from a stable
  // default (for SSR/hydration parity); this reconciles it to the user's choice
  // before paint, matching what the _document.tsx inline script already painted.
  useIsomorphicLayoutEffect(() => {
    setThemeMode(getStoredThemeMode() ?? 'system');
  }, [setThemeMode]);

  // While in `system` mode, follow live changes to the OS colour scheme.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (useCunninghamTheme.getState().themeMode === 'system') {
        setThemeMode('system');
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [setThemeMode]);

  return (
    <CunninghamProvider theme={theme} currentLocale={currentLocale}>
      {children}
    </CunninghamProvider>
  );
}
