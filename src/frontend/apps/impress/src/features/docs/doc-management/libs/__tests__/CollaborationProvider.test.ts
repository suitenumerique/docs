import { WebSocketStatus } from '@hocuspocus/provider';
import fetchMock from 'fetch-mock';
import * as Y from 'yjs';

if (typeof EventSource === 'undefined') {
  const mockEventSource = jest.fn();
  class MockEventSource {
    constructor(...args: any[]) {
      return mockEventSource(...args);
    }
  }
  (global as any).EventSource = MockEventSource;
}

import { CollaborationProvider } from '../CollaborationProvider';

const mockApplyUpdate = jest.fn();
jest.mock('yjs', () => ({
  ...jest.requireActual('yjs'),
  applyUpdate: (...args: any) => mockApplyUpdate(...args),
}));

describe('CollaborationProvider', () => {
  let config: any;
  let provider: CollaborationProvider;
  let fakeWebsocketProvider: any;

  beforeEach(() => {
    fakeWebsocketProvider = {
      on: jest.fn(),
      open: jest.fn(),
      attach: jest.fn(),
    };
    config = {
      name: 'test',
      url: 'ws://localhost/ws/',
      canEdit: true,
      websocketProvider: fakeWebsocketProvider,
    };
    provider = new CollaborationProvider(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
    fetchMock.restore();
  });

  test('constructor initializes properties and attaches event handlers', () => {
    expect(provider.canEdit).toBe(true);
    expect((provider as any).url).toBe('ws://localhost/ws/');
    expect(fakeWebsocketProvider.on).toHaveBeenCalled();
  });

  test('getStateFingerprint returns a consistent hash', () => {
    const fingerprint1 = provider.getStateFingerprint(provider.document);
    const fingerprint2 = provider.getStateFingerprint(provider.document);
    expect(typeof fingerprint1).toBe('string');
    expect(fingerprint1).toBe(fingerprint2);
  });

  test('onPollOutgoingMessage does nothing when websocket is not failed', async () => {
    fetchMock.post(/http:\/\/localhost\/ws\/poll\/message\/.*/, {
      body: JSON.stringify({ updated: false }),
    });

    provider.isWebsocketFailed = false;
    const dummyMessage = {
      toUint8Array: () => new Uint8Array([1, 2, 3]),
    } as any;
    await provider.onPollOutgoingMessage({ message: dummyMessage });
    expect(fetchMock.called()).toBe(false);
  });

  test('onPollOutgoingMessage calls pollOutgoingMessageRequest and pollSync when updated is false', async () => {
    provider.isWebsocketFailed = true;
    const dummyMessage = {
      toUint8Array: () => new Uint8Array([4, 5, 6]),
    } as any;
    fetchMock.post(/http:\/\/localhost\/ws\/poll\/message\/.*/, {
      body: JSON.stringify({ updated: false }),
    });
    const pollSyncSpy = jest.spyOn(provider, 'pollSync').mockResolvedValue();
    await provider.onPollOutgoingMessage({ message: dummyMessage });
    expect(fetchMock.lastUrl()).toContain('http://localhost/ws/poll/message/');
    expect(pollSyncSpy).toHaveBeenCalled();
  });

  test('onPollOutgoingMessage disables editing (canEdit becomes false) if API returns a 403 error', async () => {
    provider.isWebsocketFailed = true;
    const dummyMessage = {
      toUint8Array: () => new Uint8Array([7, 8, 9]),
    } as any;
    fetchMock.post(/http:\/\/localhost\/ws\/poll\/message\/.*/, {
      status: 403,
      body: JSON.stringify({}),
    });

    // Stub the off method (inherited from event emitter) to observe its call.
    provider.off = jest.fn();
    await provider.onPollOutgoingMessage({ message: dummyMessage });
    expect(fetchMock.lastUrl()).toContain('http://localhost/ws/poll/message/');
    expect(provider.off).toHaveBeenCalled();
    expect(provider.canEdit).toBe(false);
  });

  test('pollSync does nothing if websocket is not failed', async () => {
    fetchMock.post(/http:\/\/localhost\/ws\/poll\/sync\/.*/, {
      body: JSON.stringify({ syncDoc64: '123456' }),
    });

    provider.isWebsocketFailed = false;
    await provider.pollSync();
    expect(fetchMock.called()).toBe(false);
  });

  test('pollSync calls postPollSyncRequest when unsync count threshold is reached', async () => {
    const update = Y.encodeStateAsUpdate(provider.document);
    const syncDoc64 = Buffer.from(update).toString('base64');

    fetchMock.post(/http:\/\/localhost\/ws\/poll\/sync\/.*/, {
      body: JSON.stringify({ syncDoc64 }),
    });

    provider.isWebsocketFailed = true;
    provider.seemsUnsyncCount = provider.seemsUnsyncMaxCount - 1;

    await provider.pollSync();
    const uint8Array = Buffer.from(syncDoc64, 'base64');
    expect(mockApplyUpdate).toHaveBeenCalledWith(provider.document, uint8Array);
  });

  describe('onStatus', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('sets websocket failed and schedules polling on Connecting', () => {
      const initPollingSpy = jest
        .spyOn(provider, 'initPolling')
        .mockImplementation(() => {});
      const superOnStatusSpy = jest.spyOn(
        Object.getPrototypeOf(provider),
        'onStatus',
      );

      provider.onStatus({ status: WebSocketStatus.Connecting });

      expect(provider.isWebsocketFailed).toBe(true);
      // Fast-forward timer to trigger the scheduled initPolling call.
      jest.runAllTimers();
      expect(initPollingSpy).toHaveBeenCalled();

      expect(superOnStatusSpy).toHaveBeenCalledWith({
        status: WebSocketStatus.Connecting,
      });
    });

    test('calls setPollDefaultValues on Connected', () => {
      const setPollDefaultValuesSpy = jest
        .spyOn(provider, 'setPollDefaultValues')
        .mockImplementation(() => {});
      const superOnStatusSpy = jest.spyOn(
        Object.getPrototypeOf(provider),
        'onStatus',
      );

      provider.onStatus({ status: WebSocketStatus.Connected });

      expect(setPollDefaultValuesSpy).toHaveBeenCalled();
      expect(superOnStatusSpy).toHaveBeenCalledWith({
        status: WebSocketStatus.Connected,
      });
    });
  });
});
