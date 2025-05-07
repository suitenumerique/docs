import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfig } from '@/core';
import { useAuthQuery } from '@/features/auth/api';
import { useChangeUserLanguage } from '@/features/language/api/useChangeUserLanguage';
import { getMatchingLocales } from '@/features/language/utils/locale';
import { availableFrontendLanguages } from '@/i18n/initI18n';

export const useLanguageSynchronizer = () => {
  const { data: conf, isSuccess: confInitialized } = useConfig();
  const { data: user, isSuccess: userInitialized } = useAuthQuery();
  const { i18n } = useTranslation();
  const { mutateAsync: changeUserLanguage } = useChangeUserLanguage();
  const languageSynchronizing = useRef(false);

  const availableBackendLanguages = useMemo(() => {
    return conf?.LANGUAGES.map(([locale]) => locale);
  }, [conf?.LANGUAGES]);

  const synchronizeLanguage = useCallback(
    async (direction?: 'toBackend' | 'toFrontend') => {
      if (
        languageSynchronizing.current ||
        !userInitialized ||
        !confInitialized ||
        !availableBackendLanguages ||
        !availableFrontendLanguages
      ) {
        return;
      }
      languageSynchronizing.current = true;

      try {
        const userPreferredLanguages = user.language ? [user.language] : [];
        const setOrDetectedLanguages = i18n.languages;

        // Default direction depends on whether a user already has a language preference
        direction =
          direction ??
          (userPreferredLanguages.length ? 'toFrontend' : 'toBackend');

        if (direction === 'toBackend') {
          // Update user's preference from frontend's language
          const closestBackendLanguage =
            getMatchingLocales(
              availableBackendLanguages,
              setOrDetectedLanguages,
            )[0] || availableBackendLanguages[0];
          await changeUserLanguage({
            userId: user.id,
            language: closestBackendLanguage,
          });
        } else {
          // Update frontends's language from user's preference
          const closestFrontendLanguage =
            getMatchingLocales(
              availableFrontendLanguages,
              userPreferredLanguages,
            )[0] || availableFrontendLanguages[0];
          if (i18n.resolvedLanguage !== closestFrontendLanguage) {
            await i18n.changeLanguage(closestFrontendLanguage);
          }
        }
      } catch (error) {
        console.error('Error synchronizing language', error);
      } finally {
        languageSynchronizing.current = false;
      }
    },
    [
      i18n,
      user,
      userInitialized,
      confInitialized,
      availableBackendLanguages,
      changeUserLanguage,
    ],
  );

  return { synchronizeLanguage };
};
