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
    },
    components: {
      logo: {
        src: '',
        alt: '',
        widthHeader: '',
        widthFooter: '',
      },
      'la-gaufre': false,
      'home-proconnect': false,
      icon: {
        src: '/assets/icon-docs.svg',
        width: '32px',
        height: 'auto',
      },
      favicon: {
        'png-light': '/assets/favicon-light.png',
        'png-dark': '/assets/favicon-dark.png',
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
          base: 'Marianne, Inter, Roboto Flex Variable, sans-serif',
          accent: 'Marianne, Inter, Roboto Flex Variable, sans-serif',
        },
      },
    },
    components: {
      logo: {
        src: '/assets/logo-gouv.svg',
        widthHeader: '110px',
        widthFooter: '220px',
        alt: 'Gouvernement Logo',
      },
      'la-gaufre': true,
      'home-proconnect': true,
      icon: {
        src: '/assets/icon-docs-dsfr.svg',
        width: '32px',
        height: 'auto',
      },
      favicon: {
        ico: '/assets/favicon-dsfr.ico',
        'png-light': '/assets/favicon-dsfr.png',
        'png-dark': '/assets/favicon-dark-dsfr.png',
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
