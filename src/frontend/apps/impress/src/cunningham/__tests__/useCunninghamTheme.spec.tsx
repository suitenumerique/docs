import { useCunninghamTheme } from '../useCunninghamTheme';

describe('<useCunninghamTheme />', () => {
  it('has the logo correctly set', () => {
    expect(useCunninghamTheme.getState().themeTokens.logo?.src).toBe('');

    // Change theme
    useCunninghamTheme.getState().setTheme('dsfr');

    const { themeTokens } = useCunninghamTheme.getState();
    const logo = themeTokens.logo;
    expect(logo?.src).toBe('/assets/logo-gouv.svg');
    expect(logo?.widthHeader).toBe('110px');
    expect(logo?.widthFooter).toBe('220px');
  });
});
