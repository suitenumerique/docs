import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { ThemeMode, useCunninghamTheme } from '@/cunningham';

import { Box } from './Box';
import { Icon } from './Icon';
import { DropdownMenu } from './dropdown-menu/DropdownMenu';

const MODE_ICON: Record<ThemeMode, string> = {
  light: 'light_mode',
  dark: 'dark_mode',
  system: 'brightness_auto',
};

/**
 * Colour-mode switcher: light / dark / follow-system. Reads and updates the
 * persisted `themeMode` in the Cunningham theme store.
 */
export const ThemeSwitch = () => {
  const { t } = useTranslation();
  const { themeMode, setThemeMode } = useCunninghamTheme();

  const modes: { mode: ThemeMode; label: string }[] = [
    { mode: 'light', label: t('Light') },
    { mode: 'dark', label: t('Dark') },
    { mode: 'system', label: t('System') },
  ];

  const options = modes.map(({ mode, label }) => ({
    label,
    icon: <Icon iconName={MODE_ICON[mode]} $size="sm" aria-hidden />,
    value: mode,
    isSelected: themeMode === mode,
    callback: () => setThemeMode(mode),
  }));

  return (
    <DropdownMenu
      options={options}
      selectedValues={[themeMode]}
      label={t('Change theme')}
      buttonCss={css`
        transition: all var(--c--globals--transitions--duration)
          var(--c--globals--transitions--ease-out) !important;
        border-radius: var(--c--globals--spacings--st);
        padding: 0.5rem 0.6rem;
        & .material-icons {
          color: var(
            --c--contextuals--content--palette--brand--primary
          ) !important;
        }
      `}
    >
      <Box
        className="--docs--theme-switch"
        $direction="row"
        $align="center"
        aria-label={t('Change theme')}
      >
        <Icon iconName={MODE_ICON[themeMode]} $color="inherit" $size="xl" />
      </Box>
    </DropdownMenu>
  );
};
