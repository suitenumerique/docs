import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DropdownMenu, Icon, Text } from '@/components/';
import { useConfig } from '@/core';
import { useAuthQuery } from '@/features/auth';
import {
  getMatchingLocales,
  useSynchronizedLanguage,
} from '@/features/language';

export const LanguagePicker = () => {
  const { t, i18n } = useTranslation();
  const { data: conf } = useConfig();
  const { data: user } = useAuthQuery();
  const { changeLanguageSynchronized } = useSynchronizedLanguage();
  const language = i18n.language;

  // Compute options for dropdown
  const optionsPicker = useMemo(() => {
    const backendOptions = conf?.LANGUAGES ?? [[language, language]];
    return backendOptions.map(([backendLocale, backendLabel]) => {
      return {
        label: backendLabel,
        isSelected: getMatchingLocales([backendLocale], [language]).length > 0,
        callback: () => changeLanguageSynchronized(backendLocale, user),
      };
    });
  }, [changeLanguageSynchronized, conf?.LANGUAGES, language, user]);

  // Extract current language label for display
  const currentLanguageLabel =
    conf?.LANGUAGES.find(
      ([code]) => getMatchingLocales([code], [language]).length > 0,
    )?.[1] || language;

  return (
    <DropdownMenu
      options={optionsPicker}
      showArrow
      buttonCss={css`
        &:hover {
          background-color: var(
            --c--components--button--primary-text--background--color-hover
          );
        }
        border-radius: 4px;
        padding: 0.5rem 0.6rem;
        & > div {
          gap: 0.2rem;
          display: flex;
        }
        & .material-icons {
          color: var(--c--components--button--primary-text--color) !important;
        }
      `}
    >
      <Text
        $theme="primary"
        aria-label={t('Language')}
        $direction="row"
        $gap="0.5rem"
        className="--docs--language-picker-text"
      >
        <Icon iconName="translate" $color="inherit" $size="xl" />
        {currentLanguageLabel}
      </Text>
    </DropdownMenu>
  );
};
