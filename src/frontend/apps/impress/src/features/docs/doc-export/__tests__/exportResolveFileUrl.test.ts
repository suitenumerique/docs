import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  exportCorsResolveFileUrl,
  exportResolveFileUrl,
} from '../api/exportResolveFileUrl';

const DOC_ID = 'e4e0e0a0-0000-4000-8000-000000000000';
const PROXY_URL = `http://test.jest/api/v1.0/documents/${DOC_ID}/cors-proxy/?url=`;

const imageBlob = new Blob(['image'], { type: 'image/png' });

let fetchMock: ReturnType<typeof vi.fn>;

const mockResponse = (overrides = {}) => ({
  ok: true,
  status: 200,
  blob: () => Promise.resolve(imageBlob),
  ...overrides,
});

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(mockResponse());
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const fetchedUrl = () => fetchMock.mock.calls[0][0] as string;

describe('exportCorsResolveFileUrl', () => {
  test('fetches a relative URL directly, without the CORS proxy', async () => {
    const result = await exportCorsResolveFileUrl(
      DOC_ID,
      '/assets/favicon-light.png',
    );

    expect(fetchedUrl()).toBe('/assets/favicon-light.png');
    expect(result).toBe(imageBlob);
  });

  test('fetches a same origin URL directly, without the CORS proxy', async () => {
    const url = `${window.location.origin}/media/image.png`;

    await exportCorsResolveFileUrl(DOC_ID, url);

    expect(fetchedUrl()).toBe(url);
  });

  test('proxies an external URL', async () => {
    const url = 'https://example.com/image.png';

    await exportCorsResolveFileUrl(DOC_ID, url);

    expect(fetchedUrl()).toBe(`${PROXY_URL}${encodeURIComponent(url)}`);
  });

  test('does not proxy a data URL', async () => {
    const url = 'data:image/png;base64,iVBORw0KGgo=';

    await exportCorsResolveFileUrl(DOC_ID, url);

    expect(fetchedUrl()).toBe(url);
  });

  test('does not proxy a data URL that is not base64 encoded', async () => {
    const url = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';

    await exportCorsResolveFileUrl(DOC_ID, url);

    expect(fetchedUrl()).toBe(url);
  });

  test('does not proxy a data URL with an uppercase scheme', async () => {
    const url = 'DATA:image/png;base64,iVBORw0KGgo=';

    await exportCorsResolveFileUrl(DOC_ID, url);

    expect(fetchedUrl()).toBe(url);
  });

  test('proxies an external URL whose path contains "base64"', async () => {
    const url = 'https://example.com/base64/image.png';

    await exportCorsResolveFileUrl(DOC_ID, url);

    expect(fetchedUrl()).toBe(`${PROXY_URL}${encodeURIComponent(url)}`);
  });

  test('proxies an external URL that merely contains the current hostname', async () => {
    const url = `https://example.com/?redirect=${window.location.hostname}`;

    await exportCorsResolveFileUrl(DOC_ID, url);

    expect(fetchedUrl()).toBe(`${PROXY_URL}${encodeURIComponent(url)}`);
  });
});

describe('exportResolveFileUrl', () => {
  test('returns the blob when the request succeeds', async () => {
    const result = await exportResolveFileUrl('/media/image.png');

    expect(result).toBe(imageBlob);
  });

  test('returns the url when the response is not ok', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 400 }));

    const result = await exportResolveFileUrl('/media/image.png');

    expect(result).toBe('/media/image.png');
  });

  test('returns the url when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const result = await exportResolveFileUrl('/media/image.png');

    expect(result).toBe('/media/image.png');
  });
});
