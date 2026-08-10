import { describe, expect, it } from 'vitest';

import { formatFileSize, isValidEmail } from '../string';

describe('isValidEmail', () => {
  [
    {
      email: 'test',
      expected: false,
    },
    {
      email: 'test@',
      expected: false,
    },
    {
      email: 'test@test',
      expected: false,
    },
    {
      email: 'test@test.',
      expected: false,
    },
    {
      email: 'test@test.test',
      expected: true,
    },
  ].forEach(({ email, expected }) => {
    it(`asserts that email "${email}" is ${expected ? '' : 'not '}valid `, () => {
      expect(isValidEmail(email)).toBe(expected);
    });
  });
});

describe('formatFileSize', () => {
  [
    { bytes: 0, expected: '0bytes' },
    { bytes: 512, expected: '512bytes' },
    { bytes: 1024, expected: '1KB' },
    { bytes: 1536, expected: '1.5KB' },
    { bytes: 10 * 1024 * 1024, expected: '10MB' },
    { bytes: 20971520, expected: '20MB' },
    { bytes: 3 * 1024 * 1024 * 1024, expected: '3GB' },
    // Larger than the biggest unit, stays in GB
    { bytes: 2048 * 1024 * 1024 * 1024, expected: '2048GB' },
  ].forEach(({ bytes, expected }) => {
    it(`formats ${bytes} bytes as "${expected}"`, () => {
      expect(formatFileSize(bytes)).toBe(expected);
    });
  });
});
