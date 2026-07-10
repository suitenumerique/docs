import {
  THEME_MODE_STORAGE_KEY,
  getStoredThemeMode,
  useCunninghamTheme,
} from '../useCunninghamTheme';

const setSystemPrefersDark = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

const installStorageMock = () => {
  let store: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    },
  });
};

describe('<useCunninghamTheme />', () => {
  it('changing theme update tokens', () => {
    expect(
      useCunninghamTheme.getState().currentTokens.globals?.font.families.base,
    ).toBe('Inter Variable, Roboto Flex Variable, sans-serif');

    // Change theme
    useCunninghamTheme.getState().setTheme('dsfr');

    expect(
      useCunninghamTheme.getState().currentTokens.globals?.font.families.base,
    ).toBe('Marianne, Inter Variable, Roboto Flex Variable, sans-serif');
  });
});

describe('useCunninghamTheme colour mode', () => {
  beforeEach(() => {
    installStorageMock();
    setSystemPrefersDark(false);
  });

  it('setThemeMode("dark") applies the dark theme and persists it', () => {
    useCunninghamTheme.getState().setThemeMode('dark');

    expect(useCunninghamTheme.getState().theme).toBe('dark');
    expect(useCunninghamTheme.getState().themeMode).toBe('dark');
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
    expect(getStoredThemeMode()).toBe('dark');
  });

  it('setThemeMode("light") applies the default theme', () => {
    useCunninghamTheme.getState().setThemeMode('light');

    expect(useCunninghamTheme.getState().theme).toBe('default');
    expect(useCunninghamTheme.getState().themeMode).toBe('light');
  });

  it('setThemeMode("system") resolves from prefers-color-scheme', () => {
    setSystemPrefersDark(true);
    useCunninghamTheme.getState().setThemeMode('system');
    expect(useCunninghamTheme.getState().theme).toBe('dark');

    setSystemPrefersDark(false);
    useCunninghamTheme.getState().setThemeMode('system');
    expect(useCunninghamTheme.getState().theme).toBe('default');
  });

  it('getStoredThemeMode ignores invalid stored values', () => {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'bogus');
    expect(getStoredThemeMode()).toBeNull();
  });

  it('applyThemeMode resolves the theme without persisting', () => {
    useCunninghamTheme.getState().applyThemeMode('dark');

    expect(useCunninghamTheme.getState().theme).toBe('dark');
    expect(useCunninghamTheme.getState().themeMode).toBe('dark');
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBeNull();
  });
});
