import fetchMock from 'fetch-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gotoLogout } from '../utils';

// Mock the Crisp service
vi.mock('@/services/Crisp', () => ({
  terminateCrispSession: vi.fn(),
}));

describe('utils', () => {
  afterEach(() => {
    vi.clearAllMocks();
    fetchMock.restore();
  });

  it('checks support session is terminated when logout', async () => {
    const { terminateCrispSession } = await import('@/services/Crisp');

    // Mock window.location.replace
    const mockReplace = vi.fn();
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        replace: mockReplace,
      },
      writable: true,
      configurable: true,
    });

    gotoLogout();

    expect(terminateCrispSession).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(
      'http://test.jest/api/v1.0/logout/',
    );
  });
});
