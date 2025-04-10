import i18next, { Resource } from 'i18next';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfig } from '@/core';

const CACHE_KEY = 'docs_custom_translations';
const CACHE_URL_KEY = 'docs_custom_translations_url';

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(key, value);
  },
};

export const useTranslationsCustomizer = () => {
  const { data: conf } = useConfig();
  const [isCustomized, setIsCustomized] = useState<boolean | null>(null);
  const { i18n } = useTranslation();

  // Apply custom translations to i18next
  const applyCustomTranslations = useCallback(
    (translations: Resource) => {
      if (!translations) {
        setIsCustomized(false);
        return;
      }

      // Add each language's custom translations with proper namespace handling
      Object.entries(translations).forEach(([lng, namespaces]) => {
        Object.entries(namespaces).forEach(([ns, value]) => {
          i18next.addResourceBundle(lng, ns, value, true, true);
        });
      });

      const currentLanguage = i18n.language;
      void i18next.changeLanguage(currentLanguage);

      // Emit added event to make sure components re-render
      i18next.emit('added', currentLanguage, 'translation');

      setIsCustomized(true);
    },
    [i18n],
  );

  const fetchAndApplyCustomTranslations = useCallback(
    async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch custom translations');
        }

        const translations = (await response.json()) as Resource;

        // Cache for future use
        safeLocalStorage.setItem(CACHE_KEY, JSON.stringify(translations));
        safeLocalStorage.setItem(CACHE_URL_KEY, url);

        // Apply the translations
        applyCustomTranslations(translations);

        return true;
      } catch (e) {
        console.error('Error fetching custom translations:', e);
        safeLocalStorage.setItem(CACHE_KEY, 'false');
        safeLocalStorage.setItem(CACHE_URL_KEY, url || '');
        setIsCustomized(false);

        return false;
      }
    },
    [applyCustomTranslations],
  );

  // Main function to customize translations
  const customizeTranslations = useCallback(async () => {
    // Skip if already processed or no config
    if (isCustomized !== null || !conf) {
      return;
    }

    const customUrl = conf.FRONTEND_CUSTOM_TRANSLATIONS_URL;
    const cachedUrl = safeLocalStorage.getItem(CACHE_URL_KEY);

    // Fast path: If we have cached translations for the same URL
    if (cachedUrl === customUrl) {
      const cached = safeLocalStorage.getItem(CACHE_KEY);

      if (cached) {
        try {
          // Apply cached translations immediately
          if (cached !== 'false') {
            const parsedTranslations = JSON.parse(cached) as Resource;
            applyCustomTranslations(parsedTranslations);
          } else {
            setIsCustomized(false);
          }

          // Update cache in background if URL is provided
          if (customUrl) {
            void fetchAndApplyCustomTranslations(customUrl);
          }

          return;
        } catch (e) {
          console.error('Error parsing cached translations:', e);
        }
      }
    }

    // No valid cache, fetch new translations or mark as not customized
    if (customUrl) {
      await fetchAndApplyCustomTranslations(customUrl);
    } else {
      safeLocalStorage.setItem(CACHE_KEY, 'false');
      safeLocalStorage.setItem(CACHE_URL_KEY, '');
      setIsCustomized(false);
    }
  }, [
    conf,
    isCustomized,
    applyCustomTranslations,
    fetchAndApplyCustomTranslations,
  ]);

  return { customizeTranslations, isCustomized };
};
