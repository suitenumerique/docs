import { Request } from 'express';
import * as ws from 'ws';

import { hocuspocusServer } from '@/servers/hocuspocusServer';

export const collaborationWSHandler = (ws: ws.WebSocket, req: Request) => {
  ws.on('error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  try {
    hocuspocusServer.hocuspocus.handleConnection(ws, req);
  } catch (error) {
    console.error('Failed to handle WebSocket connection:', error);
    ws.close();
  }
};
