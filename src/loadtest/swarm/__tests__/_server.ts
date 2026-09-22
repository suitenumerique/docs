// A y-websocket protocol server small enough to live in a test: one Y.Doc per
// room, sync step 1/2 and awareness relayed between the sockets of a room. It
// records the headers of every upgrade, which is what the swarm is checked on.
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  sockets: Set<WebSocket>;
}

export interface TestServer {
  url: string;
  upgrades: Array<{ path: string; cookie?: string; origin?: string }>;
  rooms: Map<string, Room>;
  refuse: { status: number } | null;
  dropAll: () => void;
  close: () => Promise<void>;
}

export const startTestServer = async (): Promise<TestServer> => {
  const rooms = new Map<string, Room>();
  const upgrades: TestServer['upgrades'] = [];
  const state: { refuse: { status: number } | null } = { refuse: null };
  const http: Server = createServer((_req, res) => res.writeHead(404).end());
  const wss = new WebSocketServer({ noServer: true });

  const room = (name: string): Room => {
    let r = rooms.get(name);
    if (!r) {
      const doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);
      r = { doc, awareness, sockets: new Set() };
      doc.on('update', (update: Uint8Array, origin: unknown) => {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        const message = encoding.toUint8Array(encoder);
        for (const socket of r?.sockets ?? []) {
          if (socket !== origin) socket.send(message);
        }
      });
      awareness.on(
        'update',
        (
          {
            added,
            updated,
            removed,
          }: { added: number[]; updated: number[]; removed: number[] },
          origin: unknown,
        ) => {
          const changed = [...added, ...updated, ...removed];
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
          );
          const message = encoding.toUint8Array(encoder);
          for (const socket of r?.sockets ?? []) {
            if (socket !== origin) socket.send(message);
          }
        },
      );
      rooms.set(name, r);
    }
    return r;
  };

  http.on('upgrade', (req, socket, head) => {
    const path = req.url ?? '';
    upgrades.push({
      path,
      cookie: req.headers.cookie,
      origin: req.headers.origin,
    });
    if (state.refuse) {
      socket.write(
        `HTTP/1.1 ${state.refuse.status} Refused\r\nContent-Length: 0\r\n\r\n`,
      );
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const name = path.split('/').pop() ?? '';
      const r = room(name);
      r.sockets.add(ws);
      ws.on('message', (data: Buffer) => {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const encoder = encoding.createEncoder();
        const type = decoding.readVarUint(decoder);
        if (type === MESSAGE_SYNC) {
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, r.doc, ws);
          if (encoding.length(encoder) > 1)
            ws.send(encoding.toUint8Array(encoder));
        } else if (type === MESSAGE_AWARENESS) {
          awarenessProtocol.applyAwarenessUpdate(
            r.awareness,
            decoding.readVarUint8Array(decoder),
            ws,
          );
        }
      });
      ws.on('close', () => r.sockets.delete(ws));
      // sync step 1, as y-websocket's server does on connect
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoder, r.doc);
      ws.send(encoding.toUint8Array(encoder));
    });
  });

  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const { port } = http.address() as AddressInfo;
  return {
    url: `ws://127.0.0.1:${port}`,
    upgrades,
    rooms,
    get refuse() {
      return state.refuse;
    },
    set refuse(value) {
      state.refuse = value;
    },
    dropAll: () => {
      for (const r of rooms.values())
        for (const socket of r.sockets) socket.terminate();
    },
    close: () =>
      new Promise((resolve) => {
        for (const r of rooms.values())
          for (const socket of r.sockets) socket.terminate();
        wss.close(() => http.close(() => resolve()));
      }),
  };
};
