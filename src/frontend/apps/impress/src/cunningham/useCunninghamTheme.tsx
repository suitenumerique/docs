import merge from 'lodash/merge';
import { create } from 'zustand';

import { tokens } from './cunningham-tokens';

type Tokens = typeof tokens.themes.default &
  Partial<(typeof tokens.themes)[keyof typeof tokens.themes]>;
type ColorsTokens = Tokens['globals']['colors'];
type FontSizesTokens = Tokens['globals']['font']['sizes'];
type SpacingsTokens = Tokens['globals']['spacings'];
type ComponentTokens = Tokens['components'];
type ContextualTokens = Tokens['contextuals'];
export type Theme = keyof typeof tokens.themes;

interface ThemeStore {
  colorsTokens: Partial<ColorsTokens>;
  componentTokens: ComponentTokens;
  contextualTokens: ContextualTokens;
  currentTokens: Partial<Tokens>;
  fontSizesTokens: Partial<FontSizesTokens>;
  setTheme: (theme: Theme) => void;
  spacingsTokens: Partial<SpacingsTokens>;
  theme: Theme;
  themeTokens: Partial<Tokens['globals']>;
}

const getMergedTokens = (theme: Theme) => {
  return merge({}, tokens.themes['default'], tokens.themes[theme]);
};

const DEFAULT_THEME: Theme = 'generic';
const defaultTokens = getMergedTokens(DEFAULT_THEME);

const initialState: ThemeStore = {
  colorsTokens: defaultTokens.globals.colors,
  componentTokens: defaultTokens.components,
  contextualTokens: defaultTokens.contextuals,
  currentTokens: tokens.themes[DEFAULT_THEME] as Partial<Tokens>,
  fontSizesTokens: defaultTokens.globals.font.sizes,
  setTheme: () => {},
  spacingsTokens: defaultTokens.globals.spacings,
  theme: DEFAULT_THEME,
  themeTokens: defaultTokens.globals,
};

export const useCunninghamTheme = create<ThemeStore>((set) => ({
  ...initialState,
  setTheme: (theme: Theme) => {
    const newTokens = getMergedTokens(theme);

    set({
      colorsTokens: newTokens.globals.colors,
      componentTokens: newTokens.components,
      contextualTokens: newTokens.contextuals,
      currentTokens: tokens.themes[theme] as Partial<Tokens>,
      fontSizesTokens: newTokens.globals.font.sizes,
      spacingsTokens: newTokens.globals.spacings,
      theme,
      themeTokens: newTokens.globals,
    });
  },
}));
