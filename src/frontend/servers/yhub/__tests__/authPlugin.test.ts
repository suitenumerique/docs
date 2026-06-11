import { describe, expect, test } from 'vitest';

import { createGatewayAuthPlugin } from '@/yhubauth/authPlugin';
import { issueToken } from '@/yhubauth/internalToken';

const uwsRequest = (query: string) =>
  ({ getQuery: () => query }) as Parameters<
    ReturnType<typeof createGatewayAuthPlugin>['readAuthInfo']
  >[0];

describe('gateway auth plugin', () => {
  const plugin = createGatewayAuthPlugin();

  test('readAuthInfo resolves claims for a valid token', async () => {
    const token = issueToken({ userid: 'u1', room: 'r1', canEdit: true });
    await expect(
      plugin.readAuthInfo(uwsRequest(`yauth=${token}`)),
    ).resolves.toEqual({
      userid: 'u1',
      room: 'r1',
      canEdit: true,
    });
  });

  // The plugin throws synchronously (before any await) — the upstream uws
  // upgrade handler wraps the call in try/catch, so this surfaces as a 401.
  test('readAuthInfo throws without a token', () => {
    expect(() => plugin.readAuthInfo(uwsRequest(''))).toThrow();
  });

  test('readAuthInfo throws for a replayed token (single use)', async () => {
    const token = issueToken({ userid: 'u1', room: 'r1', canEdit: true });
    await plugin.readAuthInfo(uwsRequest(`yauth=${token}`));
    expect(() => plugin.readAuthInfo(uwsRequest(`yauth=${token}`))).toThrow();
  });

  test.each([
    [{ org: 'docs', branch: 'main', docid: 'r1' }, true, 'rw'],
    [{ org: 'docs', branch: 'main', docid: 'r1' }, false, 'r'],
    [{ org: 'docs', branch: 'main', docid: 'other' }, true, null],
    [{ org: 'evil', branch: 'main', docid: 'r1' }, true, null],
    [{ org: 'docs', branch: 'dev', docid: 'r1' }, true, null],
  ])(
    'getAccessType room binding: %o canEdit=%s → %s',
    async (room, canEdit, expected) => {
      await expect(
        plugin.getAccessType({ userid: 'u1', room: 'r1', canEdit }, room),
      ).resolves.toBe(expected);
    },
  );
});
