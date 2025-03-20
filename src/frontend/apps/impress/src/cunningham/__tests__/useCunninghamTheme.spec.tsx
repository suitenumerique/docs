import { useCunninghamTheme } from '../useCunninghamTheme';

describe('<useCunninghamTheme />', () => {
  it('has the logo correctly set', () => {
    const { themeTokens, setTheme } = useCunninghamTheme.getState();
    setTheme('default');
    const logo = themeTokens().logo;
    expect(logo?.src).toBe('/assets/logo-gouv.svg');
    expect(logo?.widthHeader).toBe('110px');
    expect(logo?.widthFooter).toBe('220px');
  });
});
