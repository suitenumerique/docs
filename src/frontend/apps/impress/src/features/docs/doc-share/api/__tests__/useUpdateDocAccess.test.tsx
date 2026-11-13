import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '@/docs/doc-management';

import { KEY_LIST_DOC_ACCESS_REQUESTS } from '../useDocAccessRequest';
import { useUpdateDocAccess } from '../useUpdateDocAccess';

describe('useUpdateDocAccess', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it('refreshes the access requests, which the new role may have covered', async () => {
    fetchMock.patch(
      'http://test.jest/api/v1.0/documents/doc-id/accesses/access-id/',
      { body: { id: 'access-id', role: Role.OWNER } },
    );

    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateDocAccess(), { wrapper });
    result.current.mutate({
      docId: 'doc-id',
      accessId: 'access-id',
      role: Role.OWNER,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [KEY_LIST_DOC_ACCESS_REQUESTS],
    });
  });
});
