import merge from 'lodash/merge';
import { create } from 'zustand';

import { tokens } from './cunningham-tokens';

type Tokens = typeof tokens.themes.default & Partial<typeof tokens.themes.dsfr>;
type ColorsTokens = Tokens['theme']['colors'];
type FontSizesTokens = Tokens['theme']['font']['sizes'];
type SpacingsTokens = Tokens['theme']['spacings'];
type ComponentTokens = Tokens['components'];
export type Theme = keyof typeof tokens.themes;

interface AuthStore {
  theme: string;
  setTheme: (theme: Theme) => void;
  themeTokens: () => Partial<Tokens['theme']>;
  colorsTokens: () => Partial<ColorsTokens>;
  fontSizesTokens: () => Partial<FontSizesTokens>;
  spacingsTokens: () => Partial<SpacingsTokens>;
  componentTokens: () => ComponentTokens;
}

export const useCunninghamTheme = create<AuthStore>((set, get) => {
  const currentTheme = () =>
    merge(
      tokens.themes['default'],
      tokens.themes[get().theme as keyof typeof tokens.themes],
    ) as Tokens;

  return {
    theme: 'dsfr',
    themeTokens: () => currentTheme().theme,
    colorsTokens: () => currentTheme().theme.colors,
    componentTokens: () => currentTheme().components,
    spacingsTokens: () => currentTheme().theme.spacings,
    fontSizesTokens: () => currentTheme().theme.font.sizes,
    setTheme: (theme: Theme) => {
      set({ theme });
    },
  };
});
