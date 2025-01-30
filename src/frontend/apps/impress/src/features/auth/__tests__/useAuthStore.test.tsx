import { Crisp } from 'crisp-sdk-web';
import fetchMock from 'fetch-mock';

import { useAuthStore } from '../useAuthStore';

jest.mock('crisp-sdk-web', () => ({
  ...jest.requireActual('crisp-sdk-web'),
  Crisp: {
    isCrispInjected: jest.fn().mockReturnValue(true),
    setTokenId: jest.fn(),
    user: {
      setEmail: jest.fn(),
    },
    session: {
      reset: jest.fn(),
    },
  },
}));

describe('useAuthStore', () => {
  afterEach(() => {
    jest.clearAllMocks();
    fetchMock.restore();
  });

  it('checks support session is terminated when logout', () => {
    window.$crisp = true;
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        replace: jest.fn(),
      },
      writable: true,
    });

    useAuthStore.getState().logout();

    expect(Crisp.session.reset).toHaveBeenCalled();
  });
});
