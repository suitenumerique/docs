import { Resource } from 'i18next';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfig } from '@/core';

export const useCustomTranslations = () => {
  const { i18n } = useTranslation();
  const { data: currentConfig } = useConfig();

  const currentCustomTranslations: Resource = useMemo(
    () => currentConfig?.theme_customization?.translations || {},
    [currentConfig],
  );

  // Overwrite translations with a resource
  const customizeTranslations = useCallback(
    (currentCustomTranslations: Resource) => {
      Object.entries(currentCustomTranslations).forEach(([lng, namespaces]) => {
        Object.entries(namespaces).forEach(([ns, value]) => {
          i18n.addResourceBundle(lng, ns, value, true, true);
        });
      });
      // trigger re-render
      if (Object.entries(currentCustomTranslations).length > 0) {
        void i18n.changeLanguage(i18n.language);
      }
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
