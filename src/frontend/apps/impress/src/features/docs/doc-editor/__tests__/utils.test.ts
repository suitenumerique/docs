import { sanitizeColor } from '../utils';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

describe('sanitizeColor', () => {
  it('accepts valid 6-digit hex colors', () => {
    expect(sanitizeColor('#1a2b3c')).toBe('#1a2b3c');
    expect(sanitizeColor('#AABBCC')).toBe('#AABBCC');
    expect(sanitizeColor('#000000')).toBe('#000000');
    expect(sanitizeColor('#ffffff')).toBe('#ffffff');
  });

  it('rejects 3-digit hex colors and returns a valid random hex color', () => {
    expect(sanitizeColor('#abc')).toMatch(HEX_COLOR_RE);
  });

  it('rejects named colors and returns a valid random hex color', () => {
    expect(sanitizeColor('red')).toMatch(HEX_COLOR_RE);
    expect(sanitizeColor('blue')).toMatch(HEX_COLOR_RE);
  });

  it('rejects CSS injection attempts and returns a valid random hex color', () => {
    expect(sanitizeColor('red; behavior: expression(alert(1))')).toMatch(
      HEX_COLOR_RE,
    );
    expect(sanitizeColor('#fff; color: red')).toMatch(HEX_COLOR_RE);
    expect(sanitizeColor('javascript:alert(1)')).toMatch(HEX_COLOR_RE);
  });

  it('rejects empty string and returns a valid random hex color', () => {
    expect(sanitizeColor('')).toMatch(HEX_COLOR_RE);
  });
});
