import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '@/docs/doc-management';

import { useCreateDocAccess } from '../useCreateDocAccess';
import { KEY_LIST_DOC_ACCESS_REQUESTS } from '../useDocAccessRequest';

describe('useCreateDocAccess', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it('refreshes the access requests, which the access may have covered', async () => {
    fetchMock.post('http://test.jest/api/v1.0/documents/doc-id/accesses/', {
      status: 201,
      body: { id: 'access-id', role: Role.EDITOR },
    });

    const queryClient = new QueryClient();
    const resetQueries = vi.spyOn(queryClient, 'resetQueries');
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateDocAccess(), { wrapper });
    result.current.mutate({
      docId: 'doc-id',
      memberId: 'user-id',
      role: Role.EDITOR,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(resetQueries).toHaveBeenCalledWith({
      queryKey: [KEY_LIST_DOC_ACCESS_REQUESTS],
    });
  });
});
