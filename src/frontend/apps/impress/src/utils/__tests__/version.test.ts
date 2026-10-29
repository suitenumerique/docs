import { describe, expect, it } from 'vitest';

import { isFrontendBehindBackend, parseVersion } from '../version';

describe('parseVersion', () => {
  [
    { version: '6.0.3', expected: [6, 0, 3] },
    { version: 'v6.10.0', expected: [6, 10, 0] },
    { version: ' 6.0.3 ', expected: [6, 0, 3] },
    { version: '6.0.3-rc.1', expected: [6, 0, 3] },
    { version: '6.0.3+build.1', expected: [6, 0, 3] },
  ].forEach(({ version, expected }) => {
    it(`parses "${version}"`, () => {
      expect(parseVersion(version)).toEqual(expected);
    });
  });

  ['NA', '', '6.0', '6.0.x', 'latest', '6.0.3.1'].forEach((invalid) => {
    it(`returns null for the unparsable version "${invalid}"`, () => {
      expect(parseVersion(invalid)).toBeNull();
    });
  });
});

describe('isFrontendBehindBackend', () => {
  [
    { frontend: '6.0.2', backend: '6.0.3', expected: true },
    { frontend: '6.0.9', backend: '6.0.10', expected: true },
    { frontend: '5.9.9', backend: '6.0.0', expected: true },
    { frontend: 'v5.0.0', backend: '6.0.0', expected: true },
    { frontend: '6.0.3', backend: '6.0.3', expected: false },
    { frontend: '6.0.3-rc.1', backend: '6.0.3', expected: false },
    { frontend: '6.0.3', backend: '6.0.2', expected: false },
    { frontend: '6.1.0', backend: '6.0.9', expected: false },
    { frontend: '6.0.3', backend: 'NA', expected: false },
    { frontend: 'unknown', backend: '6.0.3', expected: false },
  ].forEach(({ frontend, backend, expected }) => {
    it(`frontend "${frontend}" is ${expected ? '' : 'not '}behind backend "${backend}"`, () => {
      expect(isFrontendBehindBackend(frontend, backend)).toBe(expected);
    });
  });
});
