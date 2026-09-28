/**
 * Claim checks of `OidcJwtVerifier`, run against real `jose` verification with a locally
 * generated key set (no network, no mocks), for both audience modes: the standard `aud` claim
 * and a named claim such as `client_id`. Any rejection surfaces as `InvalidTokenError`, which
 * the SDK's bearer middleware turns into a 401 (see server.test.ts).
 */

import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
  type JWTPayload,
  type JWTVerifyGetKey,
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from 'jose';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import {
  OidcJwtVerifier,
  type OidcJwtVerifierOptions,
} from '@/auth/jwtVerifier.js';

const ISSUER = 'https://idp.example.test';

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

let privateKey: PrivateKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256');
  privateKey = keyPair.privateKey;
  const publicJwk = await exportJWK(keyPair.publicKey);
  jwks = createLocalJWKSet({
    keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256' }],
  });
  // Rejections are logged on purpose (see jwtVerifier.ts); keep the test output quiet.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

async function sign(
  claims: JWTPayload,
  {
    issuer = ISSUER,
    key = privateKey,
  }: { issuer?: string; key?: PrivateKey } = {},
): Promise<string> {
  return new SignJWT({ sub: 'user-1', scope: 'docs:documents:read', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

function verifier(
  options: Partial<Omit<OidcJwtVerifierOptions, 'jwks'>> = {},
): OidcJwtVerifier {
  return new OidcJwtVerifier({
    issuer: ISSUER,
    jwks,
    audienceClaim: 'aud',
    allowedAudiences: ['docs-mcp'],
    ...options,
  });
}

describe('OidcJwtVerifier', () => {
  describe('with the default `aud` claim', () => {
    test('accepts a token whose aud string is allowed', async () => {
      const token = await sign({ aud: 'docs-mcp', azp: 'docs-mcp-client' });

      const authInfo = await verifier().verifyAccessToken(token);

      expect(authInfo).toMatchObject({
        token,
        clientId: 'docs-mcp-client',
        scopes: ['docs:documents:read'],
        extra: { sub: 'user-1' },
      });
      expect(authInfo.expiresAt).toEqual(expect.any(Number));
    });

    test('accepts a token whose aud array contains an allowed value', async () => {
      const token = await sign({ aud: ['account', 'docs-mcp'] });

      await expect(verifier().verifyAccessToken(token)).resolves.toMatchObject({
        extra: { sub: 'user-1' },
      });
    });

    test('accepts any of several allowed audiences', async () => {
      const token = await sign({ aud: 'http://localhost:4455/mcp' });

      await expect(
        verifier({
          allowedAudiences: ['docs-mcp', 'http://localhost:4455/mcp'],
        }).verifyAccessToken(token),
      ).resolves.toBeDefined();
    });

    test('rejects a token with another audience', async () => {
      const token = await sign({ aud: ['account', 'another-app'] });

      await expect(verifier().verifyAccessToken(token)).rejects.toThrow(
        InvalidTokenError,
      );
    });

    test('rejects a token without aud, even if client_id would match', async () => {
      const token = await sign({ client_id: 'docs-mcp' });

      await expect(verifier().verifyAccessToken(token)).rejects.toThrow(
        InvalidTokenError,
      );
    });
  });

  describe('with a named claim such as `client_id`', () => {
    const clientIdVerifier = () =>
      verifier({
        audienceClaim: 'client_id',
        allowedAudiences: ['docs-mcp-client'],
      });

    test('accepts a token whose client_id is allowed, whatever its aud', async () => {
      const token = await sign({
        aud: 'some-api',
        client_id: 'docs-mcp-client',
      });

      await expect(
        clientIdVerifier().verifyAccessToken(token),
      ).resolves.toMatchObject({ clientId: 'docs-mcp-client' });
    });

    test('accepts a token with no aud at all', async () => {
      const token = await sign({ client_id: 'docs-mcp-client' });

      await expect(
        clientIdVerifier().verifyAccessToken(token),
      ).resolves.toBeDefined();
    });

    test('rejects a token whose client_id is not allowed', async () => {
      const token = await sign({
        aud: 'docs-mcp',
        client_id: 'another-client',
      });

      await expect(clientIdVerifier().verifyAccessToken(token)).rejects.toThrow(
        'Token client_id claim is not an allowed audience',
      );
    });

    test('rejects a token without the claim', async () => {
      const token = await sign({ aud: 'docs-mcp', azp: 'docs-mcp-client' });

      await expect(clientIdVerifier().verifyAccessToken(token)).rejects.toThrow(
        'Token has no client_id claim',
      );
    });

    test('rejects a token whose claim is not a string', async () => {
      const token = await sign({ client_id: 42 });

      await expect(clientIdVerifier().verifyAccessToken(token)).rejects.toThrow(
        InvalidTokenError,
      );
    });

    test('supports other claim names, e.g. azp', async () => {
      const token = await sign({ azp: 'docs-mcp-client' });

      await expect(
        verifier({
          audienceClaim: 'azp',
          allowedAudiences: ['docs-mcp-client'],
        }).verifyAccessToken(token),
      ).resolves.toMatchObject({ clientId: 'docs-mcp-client' });
    });
  });

  test('rejects a token from another issuer', async () => {
    const token = await sign(
      { aud: 'docs-mcp' },
      { issuer: 'https://evil.example.test' },
    );

    await expect(verifier().verifyAccessToken(token)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  test('rejects a token signed with an unknown key', async () => {
    const { privateKey: otherKey } = await generateKeyPair('RS256');
    const token = await sign({ aud: 'docs-mcp' }, { key: otherKey });

    await expect(verifier().verifyAccessToken(token)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  test('rejects a token without a subject', async () => {
    const token = await sign({ aud: 'docs-mcp', sub: undefined });

    await expect(verifier().verifyAccessToken(token)).rejects.toThrow(
      'Token has no subject (sub) claim',
    );
  });

  test('refuses to be built without any allowed audience', () => {
    expect(() => verifier({ allowedAudiences: [] })).toThrow();
  });
});
