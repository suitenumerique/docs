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

const DEFAULT_THEME: Theme = 'default';

interface AuthStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeTokens: Partial<Tokens['theme']>;
  colorsTokens: Partial<ColorsTokens>;
  fontSizesTokens: Partial<FontSizesTokens>;
  spacingsTokens: Partial<SpacingsTokens>;
  componentTokens: ComponentTokens;
}

export const useCunninghamTheme = create<AuthStore>((set) => {
  const defaultTokens = merge(
    tokens.themes['default'],
    tokens.themes[DEFAULT_THEME],
  );

  return {
    theme: DEFAULT_THEME,
    themeTokens: defaultTokens.theme,
    colorsTokens: defaultTokens.theme.colors,
    componentTokens: defaultTokens.components,
    spacingsTokens: defaultTokens.theme.spacings,
    fontSizesTokens: defaultTokens.theme.font.sizes,
    setTheme: (theme: Theme) => {
      const newTokens = merge(tokens.themes['default'], tokens.themes[theme]);

      set({
        theme,
        themeTokens: newTokens.theme,
        colorsTokens: newTokens.theme.colors,
        componentTokens: newTokens.components,
        spacingsTokens: newTokens.theme.spacings,
        fontSizesTokens: newTokens.theme.font.sizes,
      });
    },
  };
});
