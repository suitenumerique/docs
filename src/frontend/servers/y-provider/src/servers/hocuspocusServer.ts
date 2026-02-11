import { Server } from '@hocuspocus/server';

import { logger } from '@/utils';

export const hocuspocusServer = new Server({
  name: 'docs-collaboration',
  timeout: 30000,
  quiet: true,
  async onConnect({
    connectionConfig,
    documentName,
    requestParameters,
    context,
    request,
  }) {
    // `documentName` is read from the initial message from within the Yjs protocol
    // so just to avoid any risk we make sure comparing with explicit ID from the URL

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!context.roomId || documentName !== context.roomId) {
      logger(
        'Invalid room name - Probable hacking attempt:',
        documentName,
        requestParameters.get('room'),
      );
      logger('UA:', request.headers['user-agent']);
      logger('URL:', request.url);

      return Promise.reject(new Error('Wrong room name: Unauthorized'));
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeof context.readOnly !== 'boolean') {
      return Promise.reject(
        new Error(
          'Wrong hocuspocus init: readOnly property should be set in the connection handler',
        ),
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    connectionConfig.readOnly = context.readOnly;

    return Promise.resolve();
  },
  async beforeHandleMessage(data) {
    //
    // TODO: here or inside an equivalent listener "onMessage" to catch an event "ongoingEncryption"
    // so we can close all connections properly and clear data. It needs to check this information from the backend first with "fetchDocument"
    // this should be propagated to all subscribers so they can also prepare to refresh their page
    //
  },
});
