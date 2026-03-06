import { Mutex } from 'async-mutex';
import * as ws from 'ws';

const rooms = new Map<string, Set<ws.WebSocket>>();
const roomsMutex = new Mutex();
const connectionMeta = new Map<ws.WebSocket, { userId: string | null }>();

function sendMessage(ws: ws.WebSocket, data: ws.RawData) {
  if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
    ws.send(data, {}, (error) => {
      if (error) {
        ws.close();
      }
    });
  } else {
    ws.close();
  }
}

export function getRelayRoom(roomId: string): Set<ws.WebSocket> | undefined {
  return rooms.get(roomId);
}

export function closeRelayConnections(roomId: string, userId?: string): void {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  if (!userId) {
    for (const peer of Array.from(room)) {
      peer.close();
    }
  } else {
    for (const peer of Array.from(room)) {
      const meta = connectionMeta.get(peer);

      if (meta?.userId === userId) {
        peer.close();
      }
    }
  }
}

export async function handleRelayServerConnection(
  ws: ws.WebSocket,
  roomId: string,
  userId?: string | null,
) {
  ws.binaryType = 'arraybuffer'; // Same configuration in the client provider

  const roomsMutexRelease = await roomsMutex.acquire();

  let room = rooms.get(roomId);

  try {
    if (!room) {
      const roomConnections = new Set<ws.WebSocket>();

      rooms.set(roomId, roomConnections);

      room = roomConnections;
    }
  } finally {
    roomsMutexRelease();
  }

  connectionMeta.set(ws, { userId: userId ?? null });

  ws.on('error', () => {
    ws.close();
  });

  ws.on('message', (data) => {
    // relay to all other peers in the room (passthrough due to encryption)
    // it will also broadcast events about encryption transition, note that we don't close connections
    // for this from the server because the clients could retrieve connecting immediately, it's better letting
    // all clients reacting properly so they switch to the right provider
    for (const peer of Array.from(room)) {
      if (peer !== ws) {
        sendMessage(peer, data);
      }
    }
  });

  // Sending a ping signal, and expecting a response before the next iteration
  let pongReceived = true;

  ws.on('pong', () => {
    pongReceived = true;
  });

  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      ws.close();
    } else {
      pongReceived = false;

      ws.ping();
    }
  }, 30 * 1000);

  ws.on('close', async () => {
    clearInterval(pingInterval);
    ws.removeAllListeners();
    connectionMeta.delete(ws);

    const roomsMutexRelease = await roomsMutex.acquire();

    try {
      room.delete(ws);

      if (room.size === 0) {
        rooms.delete(roomId);
      }
    } finally {
      roomsMutexRelease();
    }
  });

  room.add(ws);
}
