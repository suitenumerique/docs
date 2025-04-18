import i18next, { Resource, i18n } from 'i18next';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigResponse } from '@/core/config/api/useConfig';
import { safeLocalStorage } from '@/utils/storages';

export const useTranslationsCustomizer = () => {
  const { i18n } = useTranslation();
  const translationsCustomizing = useRef(false);

  const customizeTranslations = useCallback(
    (
      customTranslationsUrl: ConfigResponse['FRONTEND_CUSTOM_TRANSLATIONS_URL'],
      cacheKey: string = 'CUSTOM_TRANSLATIONS',
    ) => {
      if (translationsCustomizing.current) {
        return;
      }
      translationsCustomizing.current = true;
      try {
        if (!customTranslationsUrl) {
          safeLocalStorage.setItem(cacheKey, '');
        } else {
          const previousTranslationsString = safeLocalStorage.getItem(cacheKey);
          if (previousTranslationsString) {
            const previousTranslations = JSON.parse(
              previousTranslationsString,
            ) as Resource;
            try {
              applyTranslations(previousTranslations, i18n);
            } catch (err: unknown) {
              console.error('Error parsing cached translations:', err);
              safeLocalStorage.setItem(cacheKey, '');
            }
          }

          // Always update in background
          fetchAndCacheTranslations(customTranslationsUrl, cacheKey)
            .then((updatedTranslations) => {
              if (
                updatedTranslations &&
                JSON.stringify(updatedTranslations) !==
                  previousTranslationsString
              ) {
                applyTranslations(updatedTranslations, i18n);
              }
            })
            .catch((err: unknown) => {
              console.error('Error fetching custom translations:', err);
            });
        }
      } catch (err: unknown) {
        console.error('Error updating custom translations:', err);
      } finally {
        translationsCustomizing.current = false;
      }
    },
    [i18n],
  );

  const applyTranslations = (translations: Resource, i18n: i18n) => {
    Object.entries(translations).forEach(([lng, namespaces]) => {
      Object.entries(namespaces).forEach(([ns, value]) => {
        i18next.addResourceBundle(lng, ns, value, true, true);
      });
    });
    const currentLanguage = i18n.language;
    void i18next.changeLanguage(currentLanguage);
  };

  const fetchAndCacheTranslations = (url: string, CACHE_KEY: string) => {
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Failed to fetch custom translations');
      }
      return response.json().then((customTranslations: Resource) => {
        safeLocalStorage.setItem(CACHE_KEY, JSON.stringify(customTranslations));
        return customTranslations;
      });
    });
  };

  return { customizeTranslations };
};
