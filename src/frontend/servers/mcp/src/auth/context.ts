/**
 * Request-scoped authentication context passed to tool handlers.
 *
 * Deliberately narrow: handlers get the authenticated user's subject and granted scopes to
 * decide what they're allowed to do, and the raw access token they hand to `docsApiClient`,
 * which forwards it as-is to Django. Handlers never parse or decode the token themselves —
 * decoding already happened once, in `jwtVerifier.ts`.
 */

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export type McpAuthContext = {
  subject: string;
  scopes: ReadonlySet<string>;
  accessToken: string;
};

export function toMcpAuthContext(
  authInfo: AuthInfo | undefined,
): McpAuthContext {
  const subject = authInfo?.extra?.sub;
  if (!authInfo || typeof subject !== 'string') {
    throw new Error('Missing or invalid auth info on request');
  }

  return {
    subject,
    scopes: new Set(authInfo.scopes),
    accessToken: authInfo.token,
  };
}
