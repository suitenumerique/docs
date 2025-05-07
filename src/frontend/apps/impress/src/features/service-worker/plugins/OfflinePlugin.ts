import { WorkboxPlugin } from 'workbox-core';

import { MESSAGE_TYPE } from '../conf';

declare const self: ServiceWorkerGlobalScope;

export class OfflinePlugin implements WorkboxPlugin {
  constructor() {}

  postMessage = async (value: boolean, message: string) => {
    const allClients = await self.clients.matchAll({
      includeUncontrolled: true,
    });

    for (const client of allClients) {
      client.postMessage({
        type: MESSAGE_TYPE.OFFLINE,
        value,
        message,
      });
    }
  };

  /**
   * Means that the fetch failed (500 is not failed), so often it is a network error.
   */
  fetchDidFail: WorkboxPlugin['fetchDidFail'] = async () => {
    void this.postMessage(true, 'fetchDidFail');
    return Promise.resolve();
  };

  fetchDidSucceed: WorkboxPlugin['fetchDidSucceed'] = async ({ response }) => {
    void this.postMessage(false, 'fetchDidSucceed');
    return Promise.resolve(response);
  };
}
