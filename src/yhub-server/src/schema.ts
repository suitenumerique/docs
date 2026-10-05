/**
 * The postgres schema the readiness probe verifies, mirroring the DDL of the
 * installed `@y/hub` (`node_modules/@y/hub/bin/init-db.js`, run as
 * `yarn init-db`). yhub never runs DDL from a server or worker process, so a
 * pod booted before the script ran — or left behind by an upgrade that added
 * a column — answers `SELECT 1` perfectly well and then fails every document
 * read. Readiness checks the schema itself, so that pod never reports ready.
 *
 * The expectation belongs to the *installed* yhub version, exactly like the
 * DDL: when `@y/hub` is upgraded and its changelog announces a schema change,
 * re-run `yarn init-db` and update this table in the same commit. Identifiers
 * are lowercase because postgres folds the unquoted ones of the DDL
 * (`gcDoc` lands in the catalog as `gcdoc`).
 */

// What the server cannot serve a document without. Both tables, and the
// columns added by ALTER after the first release — a pre-existing table is
// left untouched by `CREATE TABLE IF NOT EXISTS`, so "the table is there"
// says nothing about the columns a newer yhub reads.
export const EXPECTED_SCHEMA: Record<string, readonly string[]> = {
  yhub_ydoc_v1: [
    'org',
    'docid',
    'branch',
    't',
    'created',
    'gcdoc',
    'nongcdoc',
    'contentmap',
    'contentids',
    'gcdoc_is_reference',
    'nongcdoc_is_reference',
    'contentmap_is_reference',
    'contentids_is_reference',
  ],
  yhub_ydoc_tombstones_v1: [
    'org',
    'docid',
    'branch',
    'deleted_at',
    'hard',
    'purged_at',
    'by',
  ],
};

// The expected columns the catalog does not hold, as `table.column` — empty
// when the schema is complete. Pure, so the comparison is tested without a
// database.
export const missingSchemaColumns = (present: ReadonlySet<string>): string[] =>
  Object.entries(EXPECTED_SCHEMA).flatMap(([table, columns]) =>
    columns
      .filter((column) => !present.has(`${table}.${column}`))
      .map((column) => `${table}.${column}`),
  );

// The sql handle yhub's persistence exposes. Structurally typed rather than
// imported from `postgres` — @y/hub carries that dependency, this package does
// not.
export interface SqlTag {
  (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<{ table_name: string; column_name: string }[]>;
}

// Every expected column the catalog does not hold. One catalog query, and it
// resolves each expected table the way an unqualified read does: PostgreSQL
// picks the FIRST schema along the search path that holds the table — it
// never unions columns across schemas. Collecting columns from every schema
// of the path would let an older, incomplete `staging.yhub_ydoc_v1` shadow a
// complete `public.yhub_ydoc_v1` while the probe reports ok — drift on the
// very table document reads resolve to. `to_regclass` performs that same
// first-match resolution; a table no schema on the path holds answers NULL
// and falls out of the join, every one of its columns then reads as missing.
export const findMissingSchemaColumns = async (
  sql: SqlTag,
): Promise<string[]> => {
  const rows = await sql`
    WITH want(name) AS (SELECT unnest(${Object.keys(EXPECTED_SCHEMA)}::text[]))
    SELECT w.name AS table_name, a.attname AS column_name
    FROM want w
    JOIN LATERAL (SELECT to_regclass(w.name) AS reg) r ON true
    JOIN pg_class c ON c.oid = r.reg
    JOIN pg_attribute a
      ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  `;
  return missingSchemaColumns(
    new Set(rows.map((row) => `${row.table_name}.${row.column_name}`)),
  );
};
