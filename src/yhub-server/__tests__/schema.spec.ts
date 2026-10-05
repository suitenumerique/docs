// schema.ts — the postgres schema the readiness probe expects, and the
// catalog query that checks it. No database: `missingSchemaColumns` is pure,
// and `findMissingSchemaColumns` is driven with a fake sql tag.

import { describe, expect, it, vi } from 'vitest';

import {
  EXPECTED_SCHEMA,
  findMissingSchemaColumns,
  missingSchemaColumns,
  type SqlTag,
} from '../src/schema.js';

// The catalog rows of a deployment whose `yarn init-db` is up to date.
const completeRows = () =>
  Object.entries(EXPECTED_SCHEMA).flatMap(([table, columns]) =>
    columns.map((column) => ({ table_name: table, column_name: column })),
  );

const presentSet = (rows: { table_name: string; column_name: string }[]) =>
  new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));

// A sql tag answering with the given catalog rows whatever the query.
// typed as the real handle: if postgres.Sql ever stops being assignable to
// SqlTag, this line — not an `as never` — is where the compiler says so
const sqlReturning = (rows: { table_name: string; column_name: string }[]): SqlTag =>
  vi.fn(async () => rows) as unknown as SqlTag;

describe('missingSchemaColumns', () => {
  it('reports nothing when the catalog holds every expected column', () => {
    expect(missingSchemaColumns(presentSet(completeRows()))).toEqual([]);
  });

  it('names a column a botched upgrade left behind, and only that one', () => {
    // the ALTER-added columns are the realistic drift: CREATE TABLE IF NOT
    // EXISTS leaves a pre-existing table untouched, so an init-db missed at
    // upgrade time shows up exactly like this
    const rows = completeRows().filter(
      (row) => row.column_name !== 'contentids_is_reference',
    );
    expect(missingSchemaColumns(presentSet(rows))).toEqual([
      'yhub_ydoc_v1.contentids_is_reference',
    ]);
  });

  it('names every column of a table init-db never created', () => {
    const rows = completeRows().filter(
      (row) => row.table_name !== 'yhub_ydoc_tombstones_v1',
    );
    expect(missingSchemaColumns(presentSet(rows))).toEqual(
      EXPECTED_SCHEMA.yhub_ydoc_tombstones_v1.map(
        (column) => `yhub_ydoc_tombstones_v1.${column}`,
      ),
    );
  });
});

describe('findMissingSchemaColumns', () => {
  it('reads the catalog as table.column pairs the comparison consumes', async () => {
    // the row shape is the contract with the catalog — a query that
    // selected the columns differently would feed garbage to the comparison
    const sql = sqlReturning(completeRows());
    await expect(findMissingSchemaColumns(sql)).resolves.toEqual([]);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('reports the drift the catalog answers with', async () => {
    const sql = sqlReturning([]);
    const missing = await findMissingSchemaColumns(sql);
    // an empty catalog answer means neither table exists: every expected
    // column is missing, not none of them
    expect(missing.length).toBe(
      Object.values(EXPECTED_SCHEMA).flat().length,
    );
  });
});
