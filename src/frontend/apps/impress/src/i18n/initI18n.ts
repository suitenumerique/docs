import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import resources from './translations.json';

export const availableFrontendLanguages: readonly string[] =
  Object.keys(resources);

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    detection: {
      order: ['cookie', 'navigator'], // detection order
      caches: ['cookie'], // Use cookies to store the language preference
      lookupCookie: 'docs_language',
      cookieMinutes: 525600, // Expires after one year
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
      },
    },
    interpolation: {
      escapeValue: false,
    },
    preload: availableFrontendLanguages,
    lowerCaseLng: true,
    nsSeparator: false,
    keySeparator: false,
  })
  .catch(() => {
    throw new Error('i18n initialization failed');
  });

export default i18next;
