import { Request } from 'express';
import * as ws from 'ws';

import { COLLABORATION_INACTIVITY_TIMEOUT } from '@/env';
import { hocuspocusServer } from '@/servers/hocuspocusServer';
import { setupInactivityTimeout } from '@/utils';

export const collaborationWSHandler = (ws: ws.WebSocket, req: Request) => {
  if (COLLABORATION_INACTIVITY_TIMEOUT > 0) {
    setupInactivityTimeout(ws, COLLABORATION_INACTIVITY_TIMEOUT);
  }
  try {
    hocuspocusServer.hocuspocus.handleConnection(ws, req);
  } catch (error) {
    console.error('Failed to handle WebSocket connection:', error);
    ws.close();
  }
};
