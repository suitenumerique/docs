import { describe, expect, it, vi } from 'vitest';

describe('DocsDB', () => {
  beforeEach(() => {
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
    it(`correctly computes version for ${version}`, async () => {
      vi.doMock('@/../package.json', () => ({
        default: { version },
      }));

      const module = await import('../DocsDB');
      const result = (module as any).getCurrentVersion();
      expect(result).toBe(expected);
      expect(result).toBeGreaterThan(previousExpected);
      previousExpected = result;
    });
  });
});
