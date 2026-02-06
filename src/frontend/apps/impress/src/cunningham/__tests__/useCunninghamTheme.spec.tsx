import { useCunninghamTheme } from '../useCunninghamTheme';

describe('<useCunninghamTheme />', () => {
  it('changing theme update tokens', () => {
    expect(
      useCunninghamTheme.getState().currentTokens.globals?.font.families.base,
    ).toBe('Hanken Grotesk, Inter, Roboto Flex Variable, sans-serif');

    // Change theme
    useCunninghamTheme.getState().setTheme('dsfr');

    expect(
      useCunninghamTheme.getState().currentTokens.globals?.font.families.base,
    ).toBe('Marianne, Inter, Roboto Flex Variable, sans-serif');
  });
});
