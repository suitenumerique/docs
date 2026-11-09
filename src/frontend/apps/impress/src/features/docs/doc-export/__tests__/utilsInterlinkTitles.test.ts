import { QueryClient } from '@tanstack/react-query';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { KEY_DOC } from '@/docs/doc-management/api/useDoc';

import { resolveInterlinkTitles } from '../utils';

const DOC_URL = (id: string) => `http://test.jest/api/v1.0/documents/${id}/`;

const paragraphLinkingTo = (...docIds: string[]) => [
  {
    id: 'paragraph',
    type: 'paragraph',
    props: {},
    content: docIds.map((docId) => ({
      type: 'interlinkingLinkInline',
      props: { docId, blockId: '', disabled: false, trigger: '/' },
    })),
    children: [],
  },
];

describe('resolveInterlinkTitles', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('reads the title of a cached doc without requesting it, even stale', async () => {
    queryClient.setQueryData(
      [KEY_DOC, { id: 'cached' }],
      { id: 'cached', title: 'Meeting notes' },
      { updatedAt: 0 },
    );

    const titles = await resolveInterlinkTitles(
      paragraphLinkingTo('cached'),
      queryClient,
    );

    expect(titles.get('cached')).toBe('Meeting notes');
    expect(fetchMock.callHistory.calls()).toHaveLength(0);
  });

  it('requests a doc missing from the cache, once, and caches it', async () => {
    fetchMock.route(DOC_URL('missing'), { id: 'missing', title: 'Roadmap' });

    const titles = await resolveInterlinkTitles(
      paragraphLinkingTo('missing', 'missing'),
      queryClient,
    );

    expect(titles.get('missing')).toBe('Roadmap');
    expect(fetchMock.callHistory.calls(DOC_URL('missing'))).toHaveLength(1);
    expect(
      queryClient.getQueryData([KEY_DOC, { id: 'missing' }]),
    ).toMatchObject({ title: 'Roadmap' });
  });

  it('falls back to the URL of a doc that cannot be fetched', async () => {
    fetchMock.route(DOC_URL('forbidden'), 403);

    const titles = await resolveInterlinkTitles(
      paragraphLinkingTo('forbidden'),
      queryClient,
    );

    expect(titles.get('forbidden')).toBe('/docs/forbidden/');
  });
});
