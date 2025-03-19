import { Server } from '@hocuspocus/server';

import { fetchDocument } from '@/api/getDoc';
import { getMe } from '@/api/getMe';
import { logger } from '@/utils';

export const hocusPocusServer = Server.configure({
  name: 'docs-collaboration',
  timeout: 30000,
  quiet: true,
  async onConnect({
    requestHeaders,
    connection,
    documentName,
    requestParameters,
    context,
  }) {
    const roomParam = requestParameters.get('room');

    if (documentName !== roomParam) {
      console.error(
        'Invalid room name - Probable hacking attempt:',
        documentName,
        requestParameters.get('room'),
      );

      return Promise.reject(new Error('Wrong room name: Unauthorized'));
    }

    let can_edit = false;

    try {
      const document = await fetchDocument(documentName, requestHeaders);

      if (!document.abilities.retrieve) {
        console.error(
          'onConnect: Unauthorized to retrieve this document',
          roomParam,
        );
        return Promise.reject(new Error('Wrong abilities:Unauthorized'));
      }

      can_edit = document.abilities.update;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('onConnect: backend error', error.message);
      }

      return Promise.reject(new Error('Backend error: Unauthorized'));
    }

    connection.readOnly = !can_edit;

    /*
     * Unauthenticated users can be allowed to connect
     * so we flag only authenticated users
     */
    try {
      const user = await getMe(requestHeaders);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      context.userId = user.id;
    } catch {}

    logger(
      'Connection established:',
      documentName,
      'canEdit:',
      can_edit,
      'room:',
      requestParameters.get('room'),
    );
    return Promise.resolve();
  },
});
