import { Request } from 'express';
import * as ws from 'ws';

import { hocuspocusServer } from '@/servers/hocuspocusServer';
import { setupWSConnection } from '@/servers/standard/utils'

export const collaborationWSHandler = (ws: ws.WebSocket, req: Request) => {
  try {
    // hocuspocusServer.hocuspocus.handleConnection(ws, req);

    setupWSConnection(ws, req, {
      gc: true,
    })
  } catch (error) {
    console.error('Failed to handle WebSocket connection:', error);
    ws.close();
  }
};
