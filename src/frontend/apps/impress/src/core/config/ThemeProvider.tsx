import { CunninghamProvider } from '@gouvfr-lasuite/cunningham-react';

import { useCunninghamTheme } from '@/cunningham';
import { useLocales } from '@/i18n/useLocale';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useCunninghamTheme();
  const currentLocale = useLocales();

  return (
    <CunninghamProvider theme={theme} currentLocale={currentLocale}>
      {children}
    </CunninghamProvider>
  );
}
