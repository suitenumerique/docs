import { WebSocket } from 'ws';

import { logger } from '@/utils';

/** Slow-consumer protection: terminate clients that stop draining. */
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

/** `ws` only allows sending 1000-1003, 1007-1014 (minus reserved) and 3000-4999. */
const sanitizeCloseCode = (code: number): number =>
  code === 1000 ||
  code === 1001 ||
  code === 1011 ||
  (code >= 3000 && code <= 4999)
    ? code
    : 1000;

const safeClose = (ws: WebSocket, code: number, reason: string) => {
  if (
    ws.readyState === WebSocket.OPEN ||
    ws.readyState === WebSocket.CONNECTING
  ) {
    try {
      ws.close(sanitizeCloseCode(code), reason.slice(0, 100));
    } catch {
      ws.terminate();
    }
  }
};

/**
 * Bidirectional byte relay between the browser socket and the embedded
 * @y/hub socket. Both legs speak the y-websocket wire protocol; the gateway
 * never decodes frames (read-only enforcement happens inside @y/hub).
 */
export const startPipe = (
  client: WebSocket,
  upstream: WebSocket,
  onClose: () => void,
) => {
  let closed = false;
  const finish = () => {
    if (!closed) {
      closed = true;
      onClose();
    }
  };

  client.on('message', (data: Buffer, isBinary: boolean) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
    }
  });

  upstream.on('message', (data: Buffer, isBinary: boolean) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
      if (client.bufferedAmount > MAX_BUFFERED_BYTES) {
        logger('pipe: closing slow consumer', client.bufferedAmount);
        client.terminate();
      }
    }
  });

  client.on('close', (code, reason) => {
    safeClose(upstream, code, reason.toString());
    finish();
  });

  upstream.on('close', (code, reason) => {
    safeClose(client, code, reason.toString());
    finish();
  });

  client.on('error', (error) => {
    logger('pipe client error', error.message);
    client.terminate();
  });

  upstream.on('error', (error) => {
    logger('pipe upstream error', error.message);
    upstream.terminate();
  });
};
