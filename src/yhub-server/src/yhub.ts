// `@y/hub` re-exports its runtime helpers and the `YHub` class from the package
// index, but not the plain data types — and its `exports` map blocks the deep
// path they actually live at. Recover the one this wrapper passes around off a
// method signature of the class itself, so it stays yhub's own type rather than
// a look-alike.
import type { YHub } from '@y/hub';

export type { YHub };

/** `{ org, docid, branch }` — how yhub addresses one document on one branch. */
export type DocRef = Parameters<YHub['recheckAuth']>[0];
