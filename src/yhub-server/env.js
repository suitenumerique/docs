import { readFileSync } from 'node:fs';

// Read a config value that may be supplied either directly (`NAME`) or as a
// path to a file holding it (`NAME_FILE`) — the secret-file convention used
// across this repository, mirroring y-provider's env.ts. Shared by server.js
// and migration.js.
export const secret = (name, dflt) =>
  process.env[`${name}_FILE`]
    ? readFileSync(process.env[`${name}_FILE`], 'utf8').trim()
    : process.env[name] || dflt;
