import postgres from 'postgres';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { postgresUrl } from '../src/postgres.js';

afterEach(() => vi.unstubAllEnvs());

describe('PostgreSQL connection settings', () => {
  it('uses the driver environment for a socket when POSTGRES is absent', async () => {
    vi.stubEnv('POSTGRES', undefined);
    vi.stubEnv('PGHOST', '/run/postgresql');
    vi.stubEnv('PGPORT', '6543');
    vi.stubEnv('PGDATABASE', 'yhub');
    vi.stubEnv('PGUSER', 'yhub-user');
    vi.stubEnv('PGPASSWORD', 'example');

    const sql = postgres(postgresUrl());
    expect(sql.options.path).toBe('/run/postgresql/.s.PGSQL.6543');
    expect(sql.options.database).toBe('yhub');
    expect(sql.options.user).toBe('yhub-user');
    expect(sql.options.pass).toBe('example');
    await sql.end();
  });

  it('preserves an explicit POSTGRES URL over PG environment values', async () => {
    vi.stubEnv('POSTGRES', 'postgres://url-user@db.example:5433/url-db');
    vi.stubEnv('PGHOST', '/run/postgresql');
    vi.stubEnv('PGDATABASE', 'environment-db');
    vi.stubEnv('PGUSER', 'environment-user');

    const sql = postgres(postgresUrl());
    expect(sql.options.host).toEqual(['db.example']);
    expect(sql.options.port).toEqual([5433]);
    expect(sql.options.database).toBe('url-db');
    expect(sql.options.user).toBe('url-user');
    await sql.end();
  });
});
