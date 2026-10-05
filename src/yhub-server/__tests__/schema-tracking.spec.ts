// schema-tracking.spec.ts — the coupling guard. `EXPECTED_SCHEMA` is a
// hand-maintained mirror of the DDL of the *installed* `@y/hub`; a `@y/hub`
// upgrade that adds a table or a column without updating it would turn a
// healthy database into a fleet-wide `incomplete`, every pod reporting
// not-ready. This test reads the DDL of the installed package and fails on
// any drift, so the mirror is updated in the same commit as the bump — or
// the difference is at least a conscious decision.
//
// The DDL is parsed rather than executed: running `init-db` needs a live
// postgres and an S3 client, and the statements are plain enough that a
// strict read is honest. A formatting change upstream trips the regex — that
// is a feature: an upgrade touching the DDL must be looked at anyway.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EXPECTED_SCHEMA } from '../src/schema.js';

const ddl = readFileSync(
  fileURLToPath(new URL('../node_modules/@y/hub/bin/init-db.js', import.meta.url)),
  'utf8',
);

// Columns of a table as the installed DDL declares them: the names heading a
// line of the CREATE TABLE block (a name followed by a postgres type), plus
// the ones later releases appended via `ADD COLUMN IF NOT EXISTS`. Lowercased
// the way postgres folds the unquoted identifiers.
const declaredColumns = (table: string): string[] => {
  const block = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\s*\\)`,
  ).exec(ddl)?.[1];
  if (block == null) return [];
  const created = [...block.matchAll(/^\s+(\w+)\s+(?:text|INT8|bytea|boolean)/gm)].map(
    (match) => match[1]!.toLowerCase(),
  );
  const altered = [
    ...ddl.matchAll(
      new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS (\\w+)`, 'g'),
    ),
  ].map((match) => match[1]!.toLowerCase());
  return [...new Set([...created, ...altered])].sort();
};

describe('EXPECTED_SCHEMA tracks the installed @y/hub DDL', () => {
  it('reads a DDL that still looks like the DDL we mirrored', () => {
    // if this fails, @y/hub restructured its init-db and the parsing below
    // must be revisited before any of the other assertions means anything
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS yhub_ydoc_v1');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS yhub_ydoc_tombstones_v1');
  });

  it.each(Object.keys(EXPECTED_SCHEMA))('declares every column of %s', (table) => {
    expect([...EXPECTED_SCHEMA[table]!].sort()).toEqual(declaredColumns(table));
  });

  it('declares no table the installed @y/hub does not create', () => {
    for (const table of Object.keys(EXPECTED_SCHEMA)) {
      expect(ddl).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });
});
