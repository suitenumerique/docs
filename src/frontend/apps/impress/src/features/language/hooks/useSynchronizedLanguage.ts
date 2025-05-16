import debug from 'debug';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfig } from '@/core/config/api/useConfig';
import { User, useAuthMutation, useAuthQuery } from '@/features/auth';
import { getMatchingLocales } from '@/features/language/utils/locale';

const log = debug('features:language');

export const useSynchronizedLanguage = () => {
  const { i18n } = useTranslation();
  const { data: currentUser } = useAuthQuery();
  const { update: updateUser } = useAuthMutation();
  const { data: config } = useConfig();

  const availableFrontendLanguages = useMemo(
    () => Object.keys(i18n?.options?.resources || { en: '<- fallback' }),
    [i18n],
  );
  const availableBackendLanguages = useMemo(
    () => config?.LANGUAGES?.map(([locale]) => locale) || [],
    [config?.LANGUAGES],
  );
  const currentFrontendLanguage = useMemo(
    () => i18n.resolvedLanguage || i18n.language,
    [i18n],
  );
  const currentBackendLanguage = useMemo(
    () => currentUser?.language,
    [currentUser],
  );

  const changeBackendLanguage = useCallback(
    (language: string, user?: User) => {
      const closestBackendLanguage = getMatchingLocales(
        availableBackendLanguages,
        [language],
      )[0];

      if (!user || user.language === closestBackendLanguage) {
        return;
      }

      log('Updating backend language (%O)', {
        requested: language,
        from: user.language,
        to: closestBackendLanguage,
      });
      void updateUser({ ...user, language: closestBackendLanguage });
    },
    [availableBackendLanguages, updateUser],
  );

  const changeFrontendLanguage = useCallback(
    (language: string) => {
      const closestFrontendLanguage = getMatchingLocales(
        availableFrontendLanguages,
        [language],
      )[0];
      if (i18n.resolvedLanguage === closestFrontendLanguage) {
        return;
      }

      log('Updating frontend language (%O)', {
        requested: language,
        from: i18n.resolvedLanguage,
        to: closestFrontendLanguage,
      });
      void i18n.changeLanguage(closestFrontendLanguage);
    },
    [availableFrontendLanguages, i18n],
  );

  const changeLanguageSynchronized = useCallback(
    (language: string, user?: User) => {
      changeFrontendLanguage(language);
      changeBackendLanguage(language, user ?? currentUser);
    },
    [changeBackendLanguage, changeFrontendLanguage, currentUser],
  );

  useEffect(() => {
    if (currentBackendLanguage) {
      changeLanguageSynchronized(currentBackendLanguage);
    } else if (currentFrontendLanguage) {
      changeLanguageSynchronized(currentFrontendLanguage);
    }
  }, [
    currentBackendLanguage,
    currentFrontendLanguage,
    changeLanguageSynchronized,
    currentUser,
  ]);

  return {
    changeLanguageSynchronized,
    changeFrontendLanguage,
    changeBackendLanguage,
    availableFrontendLanguages,
    availableBackendLanguages,
    currentFrontendLanguage,
    currentBackendLanguage,
  };
};
