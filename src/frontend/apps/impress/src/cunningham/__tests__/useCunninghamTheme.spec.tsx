import { useCunninghamTheme } from '../useCunninghamTheme';

describe('<useCunninghamTheme />', () => {
  it('has the logo correctly set', () => {
    expect(useCunninghamTheme.getState().componentTokens.logo?.src).toBe('');

    // Change theme
    useCunninghamTheme.getState().setTheme('dsfr-light');

    const { componentTokens } = useCunninghamTheme.getState();
    const logo = componentTokens.logo;
    expect(logo?.src).toBe('/assets/logo-gouv.svg');
    expect(logo?.widthHeader).toBe('110px');
    expect(logo?.widthFooter).toBe('220px');
  });
});
