// The Yjs this server imports must be the very copy `@y/hub` imports. Two copies
// in one process break Yjs' constructor checks, which it warns about at startup
// ("Yjs was already imported"). `package.json` pins `@y/y` while `@y/hub` asks
// for a range, so bumping one without the other makes yarn nest a second copy
// under `@y/hub`. Renovate updates the `@y/*` packages together; this catches a
// split however it came about. Resolved, not imported: nothing is loaded.

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// resolves like `src/` does: this directory shares its node_modules
const fromServer = createRequire(import.meta.url);

describe('@y/y', () => {
  it('is the copy @y/hub imports', () => {
    const serverCopy = fromServer.resolve('@y/y');
    const hubCopy = createRequire(fromServer.resolve('@y/hub')).resolve('@y/y');

    expect(
      hubCopy,
      'two copies of @y/y are installed: pin it to the version @y/hub resolves',
    ).toBe(serverCopy);
  });
});
