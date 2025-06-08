import { Resource } from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export const useCustomTranslations = () => {
  const { i18n } = useTranslation();

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

  return {
    customizeTranslations,
  };
};
