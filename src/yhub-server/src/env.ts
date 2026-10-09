import { readFileSync } from 'node:fs';

// Read a config value that may be supplied either directly (`NAME`) or as a
// path to a file holding it (`NAME_FILE`) — the secret-file convention used
// across this repository, mirroring y-provider's env.ts. Shared by server.ts
// and migration.ts.
//
// With a default it always returns a string; without one it may return
// `undefined`, and the overloads carry that through to the caller.
export function secret(name: string, dflt: string): string;
export function secret(name: string, dflt?: string): string | undefined;
export function secret(name: string, dflt?: string): string | undefined {
  const file = process.env[`${name}_FILE`];
  return file
    ? readFileSync(file, 'utf8').trim()
    : process.env[name] || dflt;
}
