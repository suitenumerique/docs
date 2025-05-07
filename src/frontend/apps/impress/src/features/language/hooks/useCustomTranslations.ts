import { Resource } from 'i18next';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCustomTranslationsQuery } from '@/features/language/api/useCustomTranslationsQuery';

export const useCustomTranslations = (customTranslationsUrlString?: string) => {
  const { i18n } = useTranslation();

  // Parse the URL string safely
  const customTranslationsUrl = useMemo(() => {
    if (!customTranslationsUrlString) {
      return undefined;
    }
    try {
      return new URL(customTranslationsUrlString);
    } catch (error) {
      console.error('Invalid custom translations URL:', error);
      return undefined;
    }
  }, [customTranslationsUrlString]);

  // Query the custom translations
  const { data: customTranslations } = useCustomTranslationsQuery(
    customTranslationsUrl,
  );

  // Overwrite translations with a resource
  const customizeTranslations = useCallback(
    (customTranslations: Resource) => {
      Object.entries(customTranslations).forEach(([lng, namespaces]) => {
        Object.entries(namespaces).forEach(([ns, value]) => {
          i18n.addResourceBundle(lng, ns, value, true, true);
        });
      });
      // trigger re-render
      void i18n.changeLanguage(i18n.language);
    },
    [i18n],
  );

  return {
    customTranslations,
    customizeTranslations,
  };
};
