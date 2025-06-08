import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';

import { MESSAGE_TYPE } from '../conf';
import { useIsOffline, useOffline } from '../hooks/useOffline';

const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  },
  writable: true,
});

describe('useOffline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set isOffline to true when receiving an offline message', () => {
    useIsOffline.setState({ isOffline: false });

    const { result } = renderHook(() => useIsOffline());
    renderHook(() => useOffline());

    act(() => {
      const messageEvent = {
        data: {
          type: MESSAGE_TYPE.OFFLINE,
          value: true,
          message: 'Offline',
        },
      };

      mockAddEventListener.mock.calls[0][1](messageEvent);
    });

    expect(result.current.isOffline).toBe(true);
  });

  it('should set isOffline to false when receiving an online message', () => {
    useIsOffline.setState({ isOffline: false });

    const { result } = renderHook(() => useIsOffline());
    renderHook(() => useOffline());

    act(() => {
      const messageEvent = {
        data: {
          type: MESSAGE_TYPE.OFFLINE,
          value: false,
          message: 'Online',
        },
      };

      mockAddEventListener.mock.calls[0][1](messageEvent);
    });

    expect(result.current.isOffline).toBe(false);
  });
});
