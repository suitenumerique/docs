import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';

import { WebSocket, WebSocketServer } from 'ws';

import { fetchCurrentUser, fetchDocument } from '@/api/collaborationBackend';
import { YHUB_INTERNAL_PORT } from '@/env';
import { allowedOrigins } from '@/middlewares';
import { GatewayConnection } from '@/registry/connectionRegistry';
import { KICK_CLOSE_CODE } from '@/registry/kickChannel';
import {
  RoomLifecycleDeps,
  ensureFreshRoomAndRegister,
} from '@/rooms/roomLifecycle';
import { YHUB_ORG, routes } from '@/routes';
import { getCookieValue, isValidRoom, logger } from '@/utils';
import { issueToken } from '@/yhubauth/internalToken';

import { startPipe } from './wsPipe';

const UPSTREAM_DIAL_TIMEOUT_MS = 10_000;

/**
 * Rejecting before the 101 handshake means y-websocket clients see a failed
 * connection attempt (`connection-error` + backoff) instead of an
 * open-then-close — and unauthorized clients never reach @y/hub.
 */
const rejectUpgrade = (socket: Duplex, status: number, message: string) => {
  if (socket.writable) {
    socket.write(
      `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    );
  }
  socket.destroy();
};

/** Extracts the room from `/collaboration/ws/{room}` (or legacy `?room=`). */
export const extractRoom = (url: URL): string | null => {
  if (!url.pathname.startsWith(routes.COLLABORATION_WS)) {
    return null;
  }
  const segment = decodeURIComponent(
    url.pathname.slice(routes.COLLABORATION_WS.length),
  ).replace(/\/+$/, '');
  return segment || url.searchParams.get('room');
};

export interface UpgradeHandlerDeps extends RoomLifecycleDeps {
  wss: WebSocketServer;
}

export const createUpgradeHandler =
  (deps: UpgradeHandlerDeps) =>
  async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { wss, registry } = deps;
    let conn: GatewayConnection | null = null;
    try {
      const url = new URL(req.url ?? '', 'http://gateway.internal');
      const room = extractRoom(url);
      if (room === null && !url.pathname.startsWith(routes.COLLABORATION_WS)) {
        rejectUpgrade(socket, 404, 'Not Found');
        return;
      }
      if (!room || !isValidRoom(room)) {
        logger('upgrade rejected: invalid room', req.url);
        rejectUpgrade(socket, 400, 'Bad Request');
        return;
      }

      const origin = req.headers.origin;
      if (!origin || !allowedOrigins.includes(origin)) {
        logger('upgrade rejected: origin not allowed', origin);
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }
      if (!req.headers.cookie) {
        logger('upgrade rejected: no cookies');
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      let canEdit = false;
      try {
        const document = await fetchDocument(room, req.headers);
        if (!document.abilities.retrieve) {
          logger('upgrade rejected: no retrieve ability', room);
          rejectUpgrade(socket, 403, 'Forbidden');
          return;
        }
        canEdit = document.abilities.update === true;
      } catch (error) {
        logger('upgrade rejected: backend error', error);
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }

      let userId: string | undefined;
      try {
        userId = (await fetchCurrentUser(req.headers)).id;
      } catch {
        // Anonymous users on public documents are legitimate.
        userId = undefined;
      }
      const sessionKey = getCookieValue(req.headers.cookie, 'docs_sessionid');

      conn = { id: randomUUID(), room, userId, sessionKey, canEdit };
      await ensureFreshRoomAndRegister(deps, conn);
      const registered = conn;

      const token = issueToken({
        userid: userId ?? `anon:${conn.id}`,
        room,
        canEdit,
      });
      const upstream = new WebSocket(
        `ws://127.0.0.1:${YHUB_INTERNAL_PORT}/ws/${YHUB_ORG}/${room}?yauth=${token}`,
        { handshakeTimeout: UPSTREAM_DIAL_TIMEOUT_MS },
      );

      /**
       * Single cleanup path for everything that can go wrong between
       * registration and pipe start. Idempotent: once the pipe has started
       * (or a cleanup ran), `settled` short-circuits every later signal.
       */
      let settled = false;
      const failBeforePipe = (status: number, message: string) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.off('close', onClientGone);
        socket.off('error', onClientGone);
        upstream.terminate();
        void registry.deregister(registered);
        rejectUpgrade(socket, status, message);
      };
      // If the browser disappears while we wait on the upstream dial,
      // release the registration immediately: wss.handleUpgrade aborts on a
      // dead socket WITHOUT invoking its callback, so the pipe (and its
      // deregister hook) would never attach — the connection would otherwise
      // stay registered forever, kept alive by the registry heartbeat.
      const onClientGone = () => failBeforePipe(400, 'Client Closed');
      socket.once('close', onClientGone);
      socket.once('error', onClientGone);
      if (socket.destroyed) {
        // 'close' may already have fired before the listeners were attached
        onClientGone();
        return;
      }

      upstream.once('open', () => {
        if (settled) {
          upstream.terminate();
          return;
        }
        if (!socket.writable) {
          failBeforePipe(400, 'Client Closed');
          return;
        }
        wss.handleUpgrade(req, socket, head, (client) => {
          if (settled) {
            client.terminate();
            upstream.terminate();
            return;
          }
          settled = true;
          socket.off('close', onClientGone);
          socket.off('error', onClientGone);
          registered.client = client;
          registered.upstream = upstream;
          logger('client connected', room, registered.userId ?? 'anonymous');
          startPipe(client, upstream, () => {
            logger('client disconnected', room);
            void registry.deregister(registered);
          });
          if (registered.kicked) {
            // A reset-connections arrived while this handshake was in
            // flight (it could not close a socket that did not exist yet):
            // close now so the client reconnects with fresh permissions.
            client.close(KICK_CLOSE_CODE, 'connection-reset');
          }
        });
      });
      // Covers dial failures AND handshake rejections. Do not gate this on
      // readyState: when the upstream answers with a non-101 response, ws
      // runs abortHandshake which sets readyState to CLOSING *before*
      // emitting 'error' on the next tick.
      upstream.on('error', (error) => {
        logger('upstream connection error', error.message);
        failBeforePipe(503, 'Service Unavailable');
      });
    } catch (error) {
      logger('upgrade error', error);
      if (conn) {
        void registry.deregister(conn);
      }
      rejectUpgrade(socket, 500, 'Internal Server Error');
    }
  };
