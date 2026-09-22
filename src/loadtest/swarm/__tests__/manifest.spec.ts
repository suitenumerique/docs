import { describe, expect, it } from 'vitest';

import { parseManifest } from '../src/manifest.js';

const valid = {
  cookie_name: 'docs_sessionid',
  public_documents: ['p1'],
  sessions: [
    {
      user_id: 'u1',
      session_key: 'k1',
      editable_documents: ['e1'],
      readonly_documents: ['r1'],
    },
  ],
};

describe('parseManifest', () => {
  it('reads what the backend writes', () => {
    const manifest = parseManifest(JSON.stringify(valid));
    expect(manifest.cookie_name).toBe('docs_sessionid');
    expect(manifest.sessions[0]).toEqual(valid.sessions[0]);
    expect(manifest.public_documents).toEqual(['p1']);
  });

  it('fills what is missing rather than failing on it', () => {
    const manifest = parseManifest(
      JSON.stringify({ cookie_name: 'c', sessions: [{ session_key: 'k' }] }),
    );
    expect(manifest.sessions[0]).toEqual({
      user_id: '0',
      session_key: 'k',
      editable_documents: [],
      readonly_documents: [],
    });
    expect(manifest.public_documents).toEqual([]);
  });

  it.each([
    ['not json', 'not JSON'],
    ['null', 'not an object'],
    ['[]', 'no cookie_name'],
    ['{"sessions":[{"session_key":"k"}]}', 'no cookie_name'],
    ['{"cookie_name":"c","sessions":[]}', 'holds no session'],
    ['{"cookie_name":"c","sessions":[{"user_id":"u"}]}', 'no session_key'],
  ])('refuses %s', (text, message) => {
    expect(() => parseManifest(text)).toThrow(message);
  });

  it('refuses sessions that have expired', () => {
    expect(() =>
      parseManifest(
        JSON.stringify({ ...valid, expires_at: '2000-01-01T00:00:00+00:00' }),
      ),
    ).toThrow('expired');
    expect(() =>
      parseManifest(
        JSON.stringify({ ...valid, expires_at: '2999-01-01T00:00:00+00:00' }),
      ),
    ).not.toThrow();
  });
});
