import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { useAPIInfiniteQuery } from '@/api';

interface DummyItem {
  id: number;
}

interface DummyResponse {
  results: DummyItem[];
  next?: string;
}

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('helpers', () => {
  it('fetches and paginates correctly', async () => {
    const mockAPI = jest
      .fn<Promise<DummyResponse>, [{ page: number; query: string }]>()
      .mockResolvedValueOnce({
        results: [{ id: 1 }],
        next: 'url?page=2',
      })
      .mockResolvedValueOnce({
        results: [{ id: 2 }],
        next: undefined,
      });

    const { result } = renderHook(
      () => useAPIInfiniteQuery('test-key', mockAPI, { query: 'test' }),
      { wrapper: createWrapper() },
    );

    // Wait for first page
    await waitFor(() => {
      expect(result.current.data?.pages[0].results[0].id).toBe(1);
    });

    // Fetch next page
    await result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.data?.pages.length).toBe(2);
    });

    await waitFor(() => {
      expect(result.current.data?.pages[1].results[0].id).toBe(2);
    });

    expect(mockAPI).toHaveBeenCalledWith({ query: 'test', page: 1 });
    expect(mockAPI).toHaveBeenCalledWith({ query: 'test', page: 2 });
  });
});
