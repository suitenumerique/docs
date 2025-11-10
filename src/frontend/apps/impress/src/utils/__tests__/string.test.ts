import { describe, expect, it } from 'vitest';

import { isValidEmail } from '../string';

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
