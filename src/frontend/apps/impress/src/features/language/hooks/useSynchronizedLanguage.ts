import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserUpdate } from '@/core/api/useUserUpdate';
import { useConfig } from '@/core/config/api/useConfig';
import { User } from '@/features/auth';
import { getMatchingLocales } from '@/features/language/utils/locale';

export const useSynchronizedLanguage = () => {
  const { i18n } = useTranslation();
  const { mutateAsync: updateUser } = useUserUpdate();
  const { data: config } = useConfig();
  const isSynchronizingLanguage = useRef(false);

  const availableFrontendLanguages = useMemo(
    () => Object.keys(i18n?.options?.resources || { en: '<- fallback' }),
    [i18n?.options?.resources],
  );
  const availableBackendLanguages = useMemo(
    () => config?.LANGUAGES?.map(([locale]) => locale) || [],
    [config?.LANGUAGES],
  );

  const changeBackendLanguage = useCallback(
    async (language: string, user?: User) => {
      const closestBackendLanguage = getMatchingLocales(
        availableBackendLanguages,
        [language],
      )[0];

      if (user && user.language !== closestBackendLanguage) {
        await updateUser({ id: user.id, language: closestBackendLanguage });
      }
    },
    [availableBackendLanguages, updateUser],
  );

  const changeFrontendLanguage = useCallback(
    async (language: string) => {
      const closestFrontendLanguage = getMatchingLocales(
        availableFrontendLanguages,
        [language],
      )[0];
      if (
        i18n.isInitialized &&
        i18n.resolvedLanguage !== closestFrontendLanguage
      ) {
        await i18n.changeLanguage(closestFrontendLanguage);
      }
    },
    [availableFrontendLanguages, i18n],
  );

  const changeLanguageSynchronized = useCallback(
    async (language: string, user?: User) => {
      if (!isSynchronizingLanguage.current) {
        isSynchronizingLanguage.current = true;
        await changeFrontendLanguage(language);
        await changeBackendLanguage(language, user);
        isSynchronizingLanguage.current = false;
      }
    },
    [changeBackendLanguage, changeFrontendLanguage],
  );

  return {
    changeLanguageSynchronized,
    changeFrontendLanguage,
    changeBackendLanguage,
  };
};
