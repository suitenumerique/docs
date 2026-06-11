import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  consumeToken,
  issueToken,
  sweepExpiredTokens,
} from '@/yhubauth/internalToken';

const claims = { userid: 'user-1', room: 'room-1', canEdit: true };

describe('internalToken', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('issued token can be consumed once', () => {
    const token = issueToken(claims);
    expect(consumeToken(token)).toEqual(claims);
    expect(consumeToken(token)).toBeNull();
  });

  test('unknown token returns null', () => {
    expect(consumeToken('not-a-token')).toBeNull();
  });

  test('expired token returns null', () => {
    vi.useFakeTimers();
    const token = issueToken(claims);
    vi.advanceTimersByTime(10_001); // AUTH_TOKEN_TTL_MS default is 10s
    expect(consumeToken(token)).toBeNull();
  });

  test('tokens are unique and unguessable-sized', () => {
    const a = issueToken(claims);
    const b = issueToken(claims);
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url
  });

  test('sweep removes expired tokens without touching live ones', () => {
    vi.useFakeTimers();
    const oldToken = issueToken(claims);
    vi.advanceTimersByTime(9_000);
    const newToken = issueToken(claims);
    sweepExpiredTokens(Date.now() + 2_000); // old is past TTL, new is not
    vi.advanceTimersByTime(2_000);
    expect(consumeToken(oldToken)).toBeNull();
    expect(consumeToken(newToken)).toEqual(claims);
  });
});
