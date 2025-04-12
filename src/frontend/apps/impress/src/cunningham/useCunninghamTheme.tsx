import merge from 'lodash/merge';
import { create } from 'zustand';

import { tokens } from './cunningham-tokens';

type Tokens = typeof tokens.themes.default &
  Partial<(typeof tokens.themes)[keyof typeof tokens.themes]>;
type ColorsTokens = Tokens['theme']['colors'];
type FontSizesTokens = Tokens['theme']['font']['sizes'];
type SpacingsTokens = Tokens['theme']['spacings'];
type ComponentTokens = Tokens['components'];
export type Theme = keyof typeof tokens.themes;

const DEFAULT_THEME = 'generic';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeTokens: () => Partial<Tokens['theme']>;
  colorsTokens: () => Partial<ColorsTokens>;
  fontSizesTokens: () => Partial<FontSizesTokens>;
  spacingsTokens: () => Partial<SpacingsTokens>;
  componentTokens: () => ComponentTokens;
}

export const useCunninghamTheme = create<ThemeStore>((set, get) => {
  const currentTheme = () =>
    merge({}, tokens.themes['default'], tokens.themes[get().theme]);

  return {
    theme: DEFAULT_THEME,
    currentTokens: tokens.themes[DEFAULT_THEME] as Partial<Tokens>,
    themeTokens: () => currentTheme().theme,
    colorsTokens: () => currentTheme().theme.colors,
    componentTokens: () => currentTheme().components,
    spacingsTokens: () => currentTheme().theme.spacings,
    fontSizesTokens: () => currentTheme().theme.font.sizes,
    setTheme: (theme) => {
      set({
        theme,
      });
    },
  };
});
