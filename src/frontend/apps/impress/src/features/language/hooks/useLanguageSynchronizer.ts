import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigResponse } from '@/core/config/api/useConfig';
import { User } from '@/features/auth';
import { useChangeUserLanguage } from '@/features/language/api/useChangeUserLanguage';
import { getMatchingLocales } from '@/features/language/utils/locale';
import { availableFrontendLanguages } from '@/i18n/initI18n';

export const useLanguageSynchronizer = () => {
  const { i18n } = useTranslation();
  const { mutateAsync: changeUserLanguage } = useChangeUserLanguage();
  const languageSynchronizing = useRef(false);

  const synchronizeLanguage = useCallback(
    (
      languages: ConfigResponse['LANGUAGES'],
      user: User,
      direction?: 'toBackend' | 'toFrontend',
    ) => {
      if (languageSynchronizing.current || !availableFrontendLanguages) {
        return;
      }
      languageSynchronizing.current = true;

      try {
        const availableBackendLanguages = languages.map(([locale]) => locale);
        const userPreferredLanguages = user.language ? [user.language] : [];
        const setOrDetectedLanguages = i18n.languages;

        // Default direction depends on whether a user already has a language preference
        direction =
          direction ??
          (userPreferredLanguages.length ? 'toFrontend' : 'toBackend');

        if (direction === 'toBackend') {
          const closestBackendLanguage =
            getMatchingLocales(
              availableBackendLanguages,
              setOrDetectedLanguages,
            )[0] || availableBackendLanguages[0];
          changeUserLanguage({
            userId: user.id,
            language: closestBackendLanguage,
          }).catch((error) => {
            console.error('Error changing user language', error);
          });
        } else {
          const closestFrontendLanguage =
            getMatchingLocales(
              availableFrontendLanguages,
              userPreferredLanguages,
            )[0] || availableFrontendLanguages[0];
          if (i18n.resolvedLanguage !== closestFrontendLanguage) {
            i18n.changeLanguage(closestFrontendLanguage).catch((error) => {
              console.error('Error changing frontend language', error);
            });
          }
        }
      } catch (error) {
        console.error('Error synchronizing language', error);
      } finally {
        languageSynchronizing.current = false;
      }
    },
    [i18n, changeUserLanguage],
  );

  return { synchronizeLanguage };
};
