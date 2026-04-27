import * as ws from 'ws';

import { COLLABORATION_LOGGING } from './env';

export function logger(...args: unknown[]) {
  if (COLLABORATION_LOGGING === 'true') {
    console.log(new Date().toISOString(), ' --- ', ...args);
  }
}

export const toBase64 = function (str: Uint8Array) {
  return Buffer.from(str).toString('base64');
};

export function setupInactivityTimeout(
  socket: ws.WebSocket,
  delayMs: number,
): void {
  const closeInactive = () => {
    logger('Closing inactive WebSocket connection after', delayMs, 'ms');
    socket.close();
  };

  let timer = setTimeout(closeInactive, delayMs);

  socket.on('message', () => {
    logger('clear closeInactive timer');
    clearTimeout(timer);
    timer = setTimeout(closeInactive, delayMs);
  });

  socket.on('close', () => {
    clearTimeout(timer);
  });
}
