import { getDocLink, sanitizeColor } from '../utils';

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

describe('getDocLink', () => {
  const docId = 'a1b2c3d4-e5f6-4789-a123-1234567890ab';

  it('returns the doc and block ids of a same-origin doc link', () => {
    expect(
      getDocLink(`${window.location.origin}/docs/${docId}/#block-1`),
    ).toEqual({ docId, blockId: 'block-1' });
    expect(getDocLink(`/docs/${docId}/`)).toEqual({ docId });
  });

  it('returns null for external links', () => {
    expect(getDocLink(`https://example.com/docs/${docId}/`)).toBeNull();
  });

  it('returns null for same-origin links that are not documents', () => {
    expect(
      getDocLink(`${window.location.origin}/media/${docId}/file.pdf`),
    ).toBeNull();
    expect(getDocLink(`${window.location.origin}/docs/not-a-uuid/`)).toBeNull();
  });
});
