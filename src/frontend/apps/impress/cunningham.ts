import {
  dsfrGlobals,
  getUIKitThemesFromGlobals,
  whiteLabelGlobals,
} from '@gouvfr-lasuite/ui-kit';

const themeWhiteLabelLight = getUIKitThemesFromGlobals(whiteLabelGlobals, {
  prefix: 'default',
  variants: ['light'],
  overrides: {
    globals: {
      spacing: {
        '0': '0rem',
        none: '0rem',
        auto: 'auto',
        bx: '2.2rem',
        full: '100%',
        '3xs': '0.25rem',
        '2xs': '0.375rem',
      },
      font: {
        families: {
          base: 'Inter Variable, Roboto Flex Variable, sans-serif',
          accent: 'Inter Variable, Roboto Flex Variable, sans-serif',
        },
      },
    },
  },
});

const themeDefault = {
  default: themeWhiteLabelLight['default-light'],
};

const themesDSFRLight = getUIKitThemesFromGlobals(dsfrGlobals, {
  prefix: 'dsfr',
  variants: ['light'],
  overrides: {
    globals: {
      font: {
        families: {
          base: 'Marianne, Inter Variable, Roboto Flex Variable, sans-serif',
          accent: 'Marianne, Inter Variable, Roboto Flex Variable, sans-serif',
        },
      },
    },
  },
});

const themesDSFR = {
  dsfr: themesDSFRLight['dsfr-light'],
};

const docsTokens = {
  themes: {
    ...themeDefault,
    ...themesDSFR,
  },
};

export default docsTokens;
