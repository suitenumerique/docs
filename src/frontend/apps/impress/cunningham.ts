import { cunninghamConfig as tokens } from '@gouvfr-lasuite/ui-kit';

const customColors = {
  'primary-action': '#1212FF',
  'primary-bg': '#FAFAFA',
  'blue-400': '#7AB1E8',
  'blue-500': '#417DC4',
  'blue-600': '#3558A2',
  'brown-400': '#E6BE92',
  'brown-500': '#BD987A',
  'brown-600': '#745B47',
  'cyan-400': '#34BAB5',
  'cyan-500': '#009099',
  'cyan-600': '#006A6F',
  'gold-400': '#FFCA00',
  'gold-500': '#C3992A',
  'gold-600': '#695240',
  'green-400': '#34CB6A',
  'green-500': '#00A95F',
  'green-600': '#297254',
  'olive-400': '#99C221',
  'olive-500': '#68A532',
  'olive-600': '#447049',
  'orange-400': '#FF732C',
  'orange-500': '#E4794A',
  'orange-600': '#755348',
  'pink-400': '#FFB7AE',
  'pink-500': '#E18B76',
  'pink-600': '#8D533E',
  'purple-400': '#CE70CC',
  'purple-500': '#A558A0',
  'purple-600': '#6E445A',
  'yellow-400': '#D8C634',
  'yellow-500': '#B7A73F',
  'yellow-600': '#66673D',
};

tokens.themes.default.theme.colors = {
  ...tokens.themes.default.theme.colors,
  ...customColors,
};

tokens.themes.default.components = {
  ...tokens.themes.default.components,
  ...{
    'la-gauffre': {
      activated: true,
    },
    'home-proconnect': {
      activated: true,
    },
  },
};

export default tokens;
