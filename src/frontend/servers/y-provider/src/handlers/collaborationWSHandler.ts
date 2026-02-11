import { Request } from 'express';
import * as ws from 'ws';

import { hocuspocusServer } from '@/servers/hocuspocusServer';
import { setupWSConnection } from '@/servers/standard/utils';

const rooms = new Map<string, Set<ws.WebSocket>>();

export const collaborationWSHandler = (ws: ws.WebSocket, req: Request) => {
  try {
    // hocuspocusServer.hocuspocus.handleConnection(ws, req);

    // setupWSConnection(ws, req, {
    //   gc: true,
    // })

    const roomId = new URL(req.url, 'ws://x').searchParams.get('room');

    console.log('aaaaaaa');
    console.log('aaaaaaa');
    console.log(roomId);

    if (!roomId) {
      throw 111;
    }

    let room = rooms.get(roomId);
    if (!room) {
      const roomConnections = new Set<ws.WebSocket>();

      rooms.set(roomId, roomConnections);

      room = roomConnections;
    }

    room.add(ws);

    ws.on('message', (data) => {
      console.log('bbbbbbb');

      // TODO:
      // TODO:
      // TODO: validate the message format... to avoid non-sense to go here? other provider servers
      // TODO: were using patching on Y.Doc, so spread modifications were always valid
      // TODO:
      // TODO: should not encrypt awareness? or maybe it should...
      // TODO:
      // TODO:
      // TODO:
      // TODO: in the client messages should also be encoded at readMessage/bc.publish?
      // TODO:
      // TODO:
      // TODO: IL faudrait regarder les custom providers des autres projets E2EE pour voir ce qui a marché ou non...
      // TODO:
      // TODO:

      // relay blindly (encrypted frames only)
      const roomConnections = rooms.get(roomId);

      if (roomConnections) {
        for (const peer of Array.from(roomConnections)) {
          if (peer !== ws && peer.readyState === ws.OPEN) {
            peer.send(data);
          }
        }
      }
    });

    ws.on('close', () => {
      console.log('ccccc');

      const roomConnections = rooms.get(roomId);

      if (roomConnections) {
        roomConnections.delete(ws);

        if (roomConnections.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  } catch (error) {
    console.error('Failed to handle WebSocket connection:', error);
    ws.close();
  }
};
