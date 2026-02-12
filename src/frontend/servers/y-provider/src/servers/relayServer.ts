import { Mutex } from 'async-mutex';
import * as ws from 'ws';

const rooms = new Map<string, Set<ws.WebSocket>>();
const roomsMutex = new Mutex();

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

export async function handleRelayServerConnection(
  ws: ws.WebSocket,
  roomId: string,
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

  ws.on('error', () => {
    ws.close();
  });

  ws.on('message', (data) => {
    if (data.toString() === 'ongoingDecryption') {
      //
      // TODO: here or inside an equivalent listener "onMessage" to catch an event "ongoingEncryption"
      // so we can close all connections properly and clear data. It needs to check this information from the backend first with "fetchDocument"
      // this should be propagated to all subscribers so they can also prepare to refresh their page
      //
      return;
    }

    // Relay blindly since this server is a passthrough due to encryption
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
