import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { fetchAPI } from '@/api';

describe('fetchAPI', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it('adds correctly the basename', () => {
    fetchMock.route('http://test.jest/api/v1.0/some/url', 200);

    void fetchAPI('some/url');

    expect(fetchMock.callHistory.lastCall()?.url).toEqual(
      'http://test.jest/api/v1.0/some/url',
    );
  });

  it('adds the credentials automatically', () => {
    fetchMock.route('http://test.jest/api/v1.0/some/url', 200);

    void fetchAPI('some/url', { method: 'POST', body: 'some body' });

    expect(fetchMock.callHistory.lastCall()?.args[1]).toEqual({
      method: 'POST',
      body: 'some body',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('check the versioning', () => {
    fetchMock.route('http://test.jest/api/v2.0/some/url', 200);

    void fetchAPI('some/url', {}, '2.0');

    expect(fetchMock.callHistory.lastCall()?.url).toEqual(
      'http://test.jest/api/v2.0/some/url',
    );
  });

  it('removes Content-Type header when withoutContentType is true', async () => {
    fetchMock.route('http://test.jest/api/v1.0/some/url', 200);

    await fetchAPI('some/url', { withoutContentType: true });

    const options = fetchMock.callHistory.lastCall()?.options;
    expect(options?.headers).not.toHaveProperty('Content-Type');
  });
});
