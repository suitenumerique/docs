import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDoc } from '@/docs/doc-management/api/useDoc';
import { AppWrapper } from '@/tests/utils';

import { useCollaboration } from '../useCollaboration';

const { mockReconnect } = vi.hoisted(() => ({ mockReconnect: vi.fn() }));

vi.mock('@/core/config', async () => {
  const actual = await vi.importActual<any>('@/core/config');
  return {
    ...actual,
    useCollaborationUrl: () => 'ws://test.jest/collaboration/ws/v1/docs',
    useConfig: () => ({ data: {} }),
  };
});

vi.mock('@/stores/useBroadcastStore', () => ({
  useBroadcastStore: () => ({
    addTask: vi.fn(),
    setBroadcastProvider: vi.fn(),
    cleanupBroadcast: vi.fn(),
    provider: undefined,
  }),
}));

// a provider the collaboration server has just refused for good (4404)
vi.mock('@/docs/doc-management/stores/useProviderStore', () => ({
  useProviderStore: () => ({
    provider: {},
    isReady: true,
    hasLostConnection: false,
    isPermanentlyClosed: true,
    reconnect: mockReconnect,
    createProvider: vi.fn(),
    destroyProvider: vi.fn(),
    setReady: vi.fn(),
    resetLostConnection: vi.fn(),
    pauseForInactivity: vi.fn(),
    resumeFromInactivity: vi.fn(),
  }),
}));

const docId = 'test-doc-id';
const docUrl = `http://test.jest/api/v1.0/documents/${docId}/`;

// the doc page holds the doc query that `useCollaboration` refetches: it has to
// be observed first, or the refetch finds no active query and skips it
const renderUseCollaboration = () =>
  renderHook(
    () => {
      const doc = useDoc({ id: docId });
      useCollaboration(docId);
      return doc;
    },
    { wrapper: AppWrapper },
  ).result;

describe('useCollaboration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it('reconnects once the backend confirms the doc is there', async () => {
    fetchMock.get(docUrl, { body: { id: docId, deleted_at: null } });

    renderUseCollaboration();

    await waitFor(() => expect(mockReconnect).toHaveBeenCalled());
  });

  it('does not reconnect to a deleted doc its owner can still fetch', async () => {
    fetchMock.get(docUrl, {
      body: { id: docId, deleted_at: '2026-10-01T00:00:00Z' },
    });

    const result = renderUseCollaboration();

    // the refetch has settled, and the reconnect decision with it
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isFetching).toBe(false);
    });

    expect(mockReconnect).not.toHaveBeenCalled();
  });
});
