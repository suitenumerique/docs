import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/../package.json', () => ({
  default: { version: '0.0.0' },
}));

describe('DocsDB', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  let previousExpected = 0;

  [
    { version: '0.0.1', expected: 1 },
    { version: '0.10.15', expected: 10015 },
    { version: '1.0.0', expected: 1000000 },
    { version: '2.105.3', expected: 2105003 },
    { version: '3.0.0', expected: 3000000 },
    { version: '10.20.30', expected: 10020030 },
  ].forEach(({ version, expected }) => {
    it(`correctly computes version for ${version}`, () => {
      vi.doMock('@/../package.json', () => ({
        default: { version },
      }));

      return vi.importActual('../DocsDB').then((module: any) => {
        const result = module.getCurrentVersion();
        expect(result).toBe(expected);
        expect(result).toBeGreaterThan(previousExpected);
        previousExpected = result;
      });
    });
  });
});
