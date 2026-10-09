import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { useMentionableUsers } from '../useMentionableUsers';

const ACCESSES_URL = 'http://test.jest/api/v1.0/documents/doc-id/accesses/';

describe('useMentionableUsers', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(ACCESSES_URL, [
      {
        id: 'access-1',
        role: 'editor',
        max_role: 'editor',
        user: { id: '1', full_name: 'Dupont Thomas', short_name: 'Thomas' },
      },
      {
        id: 'access-2',
        role: 'reader',
        max_role: 'reader',
        user: { id: '2', full_name: 'Sarah Reader', short_name: 'Sarah' },
      },
    ]);
  });

  it('loads the accesses of the doc and returns the users to mention', async () => {
    const { result } = renderHook(
      () => useMentionableUsers({ docId: 'doc-id', search: 'dup' }),
      { wrapper: AppWrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.users.map(({ id }) => id)).toEqual(['1']);
  });

  it('does not load anything when disabled', async () => {
    const { result } = renderHook(
      () =>
        useMentionableUsers({ docId: 'doc-id', search: '', enabled: false }),
      { wrapper: AppWrapper },
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.users).toEqual([]);
    expect(fetchMock.callHistory.calls(ACCESSES_URL)).toHaveLength(0);
  });

  it('does not load anything without a doc', async () => {
    const { result } = renderHook(() => useMentionableUsers({ search: '' }), {
      wrapper: AppWrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.users).toEqual([]);
    expect(fetchMock.callHistory.calls()).toHaveLength(0);
  });
});
