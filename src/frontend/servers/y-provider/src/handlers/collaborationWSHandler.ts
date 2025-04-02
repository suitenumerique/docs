import { Request } from 'express';
import * as ws from 'ws';

import { hocusPocusServer } from '@/servers/hocusPocusServer';

export const collaborationWSHandler = (ws: ws.WebSocket, req: Request) => {
  try {
    hocusPocusServer.handleConnection(ws, req);
  } catch (error) {
    console.error('Failed to handle WebSocket connection:', error);
    ws.close();
  }
};
