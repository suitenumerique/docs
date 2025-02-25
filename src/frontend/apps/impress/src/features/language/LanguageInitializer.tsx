import i18n from 'i18next';
import { useEffect, useState } from 'react';

import { useConfig } from '@/core';
import { useAuthQuery } from '@/features/auth/api/useAuthQuery';
import { useChangeUserLanguage } from '@/features/language/api/useChangeUserLanguage';
import { availableFrontendLanguages } from '@/i18n/initI18n';

import { getMatchingLocales } from './utils/locale';

const LanguageInitializer = () => {
  const [initialized, setInitialized] = useState(false);
  const { data: user } = useAuthQuery();
  const { data: conf } = useConfig();
  const { mutateAsync: changeUserLanguage } = useChangeUserLanguage();

  /*
    In the language initializer we do one of two things:
  */
  useEffect(() => {
    if (initialized) {
      return;
    }
    if (!user || !conf?.LANGUAGES) {
      return;
    }
    const availableBackendLanguageLocales = conf.LANGUAGES.map(
      ([locale]) => locale,
    );
    const availableFrontendLanguageLocales = availableFrontendLanguages;

    if (user.language) {
      // 1. Update the frontend language from the backend language (user-preference)
      const currentBackendLanguageLocales = user.language
        ? [user.language]
        : [];
      const matchingFrontendLanguageLocale =
        getMatchingLocales(
          availableFrontendLanguageLocales,
          currentBackendLanguageLocales,
        )[0] || availableFrontendLanguageLocales[0];

      if (i18n.resolvedLanguage !== matchingFrontendLanguageLocale) {
        void i18n.changeLanguage(matchingFrontendLanguageLocale);
      }
    } else {
      // 2. Update the backend language from the frontend language (browser-detected)
      const currentFrontendLanguageLocales = i18n.languages;
      const matchingBackendLanguageLocale =
        getMatchingLocales(
          availableBackendLanguageLocales,
          currentFrontendLanguageLocales,
        )[0] || availableBackendLanguageLocales[0];

      void changeUserLanguage({
        userId: user.id,
        language: matchingBackendLanguageLocale,
      });
    }
    setInitialized(true);
  }, [initialized, user, conf, changeUserLanguage]);

  return null;
};

export default LanguageInitializer;
