import merge from 'lodash/merge';
import { create } from 'zustand';

import { tokens } from './cunningham-tokens';

type Tokens = typeof tokens.themes.default;
type ColorsTokens = Tokens['theme']['colors'];
type FontSizesTokens = Tokens['theme']['font']['sizes'];
type SpacingsTokens = Tokens['theme']['spacings'];
type ComponentTokens = Tokens['components'];
export type Theme = keyof typeof tokens.themes;

interface ThemeStore {
  theme: string;
  currentTokens: Partial<Tokens>;
  setTheme: (theme: string) => void;
  themeTokens: () => Partial<Tokens['theme']>;
  colorsTokens: () => Partial<ColorsTokens>;
  fontSizesTokens: () => Partial<FontSizesTokens>;
  spacingsTokens: () => Partial<SpacingsTokens>;
  componentTokens: () => ComponentTokens;
}

export const useCunninghamTheme = create<ThemeStore>((set, get) => {
  const currentTheme = () =>
    merge(tokens.themes['default'], tokens.themes[get().theme as Theme]);

  return {
    theme: 'default',
    currentTokens: tokens.themes['default'],
    themeTokens: () => currentTheme().theme,
    colorsTokens: () => currentTheme().theme.colors,
    componentTokens: () => currentTheme().components,
    spacingsTokens: () => currentTheme().theme.spacings,
    fontSizesTokens: () => currentTheme().theme.font.sizes,
    setTheme: (theme) => {
      set({
        theme,
        currentTokens: tokens.themes[theme as Theme] as Partial<Tokens>,
      });
    },
  };
});
