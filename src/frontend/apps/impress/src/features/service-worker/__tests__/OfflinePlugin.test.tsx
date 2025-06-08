/**
 * @jest-environment node
 */

import '@testing-library/jest-dom';

import { MESSAGE_TYPE } from '../conf';
import { OfflinePlugin } from '../plugins/OfflinePlugin';

const mockServiceWorkerScope = {
  clients: {
    matchAll: jest.fn().mockResolvedValue([]),
  },
} as unknown as ServiceWorkerGlobalScope;

(global as any).self = {
  ...global,
  clients: mockServiceWorkerScope.clients,
} as unknown as ServiceWorkerGlobalScope;

describe('OfflinePlugin', () => {
  afterEach(() => jest.clearAllMocks());

  it(`calls fetchDidSucceed`, async () => {
    const apiPlugin = new OfflinePlugin();
    const postMessageSpy = jest.spyOn(apiPlugin, 'postMessage');

    await apiPlugin.fetchDidSucceed?.({
      response: new Response(),
    } as any);

    expect(postMessageSpy).toHaveBeenCalledWith(false, 'fetchDidSucceed');
  });

  it(`calls fetchDidFail`, async () => {
    const apiPlugin = new OfflinePlugin();
    const postMessageSpy = jest.spyOn(apiPlugin, 'postMessage');

    await apiPlugin.fetchDidFail?.({} as any);

    expect(postMessageSpy).toHaveBeenCalledWith(true, 'fetchDidFail');
  });

  it(`calls postMessage`, async () => {
    const apiPlugin = new OfflinePlugin();
    const mockClients = [
      { postMessage: jest.fn() },
      { postMessage: jest.fn() },
    ];

    mockServiceWorkerScope.clients.matchAll = jest
      .fn()
      .mockResolvedValue(mockClients);

    await apiPlugin.postMessage(false, 'testMessage');

    for (const client of mockClients) {
      expect(client.postMessage).toHaveBeenCalledWith({
        type: MESSAGE_TYPE.OFFLINE,
        value: false,
        message: 'testMessage',
      });
    }
  });
});
