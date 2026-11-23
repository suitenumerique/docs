import { render, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewDocPage from '@/pages/docs/new';
import { AppWrapper } from '@/tests/utils';

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  useAuth: () => ({ authenticated: true }),
}));

describe('NewDocPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it('replaces /docs/new with the created doc in the history', async () => {
    fetchMock.post('http://test.jest/api/v1.0/documents/', {
      status: 201,
      body: { id: 'new-doc-id' },
    });

    render(<NewDocPage />, { wrapper: AppWrapper });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/docs/new-doc-id');
    });
    expect(router.push).not.toHaveBeenCalled();
  });
});
