import { DEFAULT_LOCALE, Locales } from '@gouvfr-lasuite/ui-components';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfig } from '@/core/config/api/useConfig';

export function useLocales() {
  const { i18n } = useTranslation();
  const { data: conf } = useConfig();
  const [currentLocale, setCurrentLocale] = useState<Locales>(DEFAULT_LOCALE);
  const resolvedLanguage = i18n.resolvedLanguage ?? i18n.language;

  useEffect(() => {
    const rawLocale =
      conf?.LANGUAGES.find(([code]) =>
        code.startsWith(resolvedLanguage),
      )?.[0] ?? resolvedLanguage;
    const [lang, region] = rawLocale.split('-');
    const currentLocale = region
      ? `${lang}-${region.toUpperCase()}`
      : rawLocale;

    setCurrentLocale(currentLocale as Locales);
  }, [resolvedLanguage, conf?.LANGUAGES]);

  return currentLocale;
}
