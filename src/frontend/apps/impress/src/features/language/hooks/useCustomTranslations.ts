import { Resource } from 'i18next';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useCustomTranslationsQuery } from '@/features/language';

export const useCustomTranslations = () => {
  const { i18n } = useTranslation();
  const { data: currentCustomTranslations } = useCustomTranslationsQuery();

  // Overwrite translations with a resource
  const customizeTranslations = useCallback(
    (currentCustomTranslations: Resource) => {
      Object.entries(currentCustomTranslations).forEach(([lng, namespaces]) => {
        Object.entries(namespaces).forEach(([ns, value]) => {
          i18n.addResourceBundle(lng, ns, value, true, true);
        });
      });
      // trigger re-render
      void i18n.changeLanguage(i18n.language);
    },
    [i18n],
  );

  useEffect(() => {
    if (currentCustomTranslations) {
      customizeTranslations(currentCustomTranslations);
    }
  }, [currentCustomTranslations, customizeTranslations]);

  return {
    currentCustomTranslations,
    customizeTranslations,
  };
};
