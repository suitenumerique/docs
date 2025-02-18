import { Settings } from 'luxon';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DropdownMenu, Text } from '@/components/';
import { LANGUAGES_ALLOWED } from '@/i18n/conf';

export const LanguagePicker = () => {
  const { t, i18n } = useTranslation();
  const { preload: languages } = i18n.options;
  const language = i18n.language;
  Settings.defaultLocale = language;

  const optionsPicker = useMemo(() => {
    return (languages || []).map((lang) => ({
      label: LANGUAGES_ALLOWED[lang],
      isSelected: language === lang,
      callback: () => {
        i18n.changeLanguage(lang).catch((err) => {
          console.error('Error changing language', err);
        });
      },
    }));
  }, [i18n, language, languages]);

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
      >
        <Text $isMaterialIcon $color="inherit" $size="xl">
          translate
        </Text>
        {LANGUAGES_ALLOWED[language]}
      </Text>
    </DropdownMenu>
  );
};
