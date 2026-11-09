import { describe, expect, test } from 'vitest';

import { APIError } from '@/api';

import { DEFAULT_QUERY_RETRY, defaultQueryRetry } from '../AppProvider';

describe('defaultQueryRetry', () => {
  test.each([401, 403, 404])('does not retry a %i answer', (status) => {
    expect(defaultQueryRetry(0, new APIError('denied', { status }))).toBe(
      false,
    );
  });

  test.each([500, 502, 503])('retries a %i answer once', (status) => {
    const error = new APIError('failed', { status });

    expect(defaultQueryRetry(0, error)).toBe(true);
    expect(defaultQueryRetry(DEFAULT_QUERY_RETRY, error)).toBe(false);
  });

  test('retries a network error once', () => {
    const error = new TypeError('Failed to fetch');

    expect(defaultQueryRetry(0, error)).toBe(true);
    expect(defaultQueryRetry(DEFAULT_QUERY_RETRY, error)).toBe(false);
  });
});
