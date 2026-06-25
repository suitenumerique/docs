import {
  LanguagePicker as LanguagePickerUIKit,
  LanguagesOption,
} from '@gouvfr-lasuite/ui-kit';
import { announce } from '@react-aria/live-announcer';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, DropdownMenu, Icon } from '@/components/';
import { useConfig } from '@/core';
import { useAuthQuery } from '@/features/auth';
import {
  getMatchingLocales,
  useSynchronizedLanguage,
} from '@/features/language';

/**
 * LanguagePickerLegacy component for selecting language.
 * We still have some legacy code that uses this component, so we keep it for now.
 * @deprecated Use LanguagePicker instead.
 * @returns JSX.Element
 */
export const LanguagePickerLegacy = () => {
  const { t, i18n } = useTranslation();
  const { data: conf } = useConfig();
  const { data: user } = useAuthQuery();
  const { changeLanguageSynchronized } = useSynchronizedLanguage();
  const language = i18n.language;

  const toLangTag = (locale: string) => locale.replace('_', '-');

  // Compute options for dropdown
  const optionsPicker = useMemo(() => {
    const backendOptions = conf?.LANGUAGES ?? [[language, language]];
    return backendOptions.map(([backendLocale, backendLabel]) => {
      return {
        label: backendLabel,
        lang: toLangTag(backendLocale),
        value: backendLocale,
        isSelected: getMatchingLocales([backendLocale], [language]).length > 0,
        callback: async () => {
          await changeLanguageSynchronized(backendLocale, user);
          announce(
            t('Language changed to {{language}}', {
              language: backendLabel,
              defaultValue: `Language changed to ${backendLabel}`,
            }),
            'polite',
          );
        },
      };
    });
  }, [changeLanguageSynchronized, conf?.LANGUAGES, language, t, user]);

  // Extract current language label for display
  const [currentLanguageCode, currentLanguageLabel] = conf?.LANGUAGES.find(
    ([code]) => getMatchingLocales([code], [language]).length > 0,
  ) ?? [language, language];

  return (
    <DropdownMenu
      options={optionsPicker}
      showArrow
      label={t('Select language')}
      buttonCss={css`
        transition: all var(--c--globals--transitions--duration)
          var(--c--globals--transitions--ease-out) !important;
        border-radius: var(--c--globals--spacings--st);
        padding: 0.5rem 0.6rem;
        & > div {
          gap: 0.2rem;
          display: flex;
        }
        & .material-icons {
          color: var(
            --c--contextuals--content--palette--brand--primary
          ) !important;
        }
      `}
    >
      <Box
        className="--docs--language-picker-text"
        $theme="brand"
        $variation="tertiary"
        $direction="row"
        $gap="0.5rem"
        $align="center"
      >
        <Icon iconName="translate" $color="inherit" $size="xl" />
        <span lang={toLangTag(currentLanguageCode)}>
          {currentLanguageLabel}
        </span>
      </Box>
    </DropdownMenu>
  );
};

export const LanguagePicker = () => {
  const { t, i18n } = useTranslation();
  const { data: conf } = useConfig();
  const { data: user } = useAuthQuery();
  const { changeLanguageSynchronized } = useSynchronizedLanguage();
  const language = i18n.language;

  const languages: LanguagesOption[] = useMemo(() => {
    const backendOptions = conf?.LANGUAGES ?? [[language, language]];
    return backendOptions.map(([backendLocale, backendLabel]) => ({
      label: backendLabel,
      value: backendLocale,
      isChecked: getMatchingLocales([backendLocale], [language]).length > 0,
    }));
  }, [conf?.LANGUAGES, language]);

  const onChange = (value: string) => {
    const lang = conf?.LANGUAGES?.find(([code]) => code === value);
    const backendLabel = lang?.[1] ?? value;
    void changeLanguageSynchronized(value, user).then(() => {
      announce(
        t('Language changed to {{language}}', {
          language: backendLabel,
          defaultValue: `Language changed to ${backendLabel}`,
        }),
        'polite',
      );
    });
  };

  return (
    <LanguagePickerUIKit
      languages={languages}
      size="small"
      onChange={onChange}
      compact
    />
  );
};
