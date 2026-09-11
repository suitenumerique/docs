import { EventEmitter } from 'node:events';

import { Request } from 'express';
import { describe, expect, test, vi } from 'vitest';
import { WebSocket } from 'ws';

vi.mock('@/servers/hocuspocusServer', () => ({
  hocuspocusServer: {
    hocuspocus: {
      handleConnection: vi.fn(),
    },
  },
}));

import { collaborationWSHandler } from '@/handlers/collaborationWSHandler';
import { hocuspocusServer } from '@/servers/hocuspocusServer';

const handleConnectionMock = vi.spyOn(
  hocuspocusServer.hocuspocus,
  'handleConnection',
);

const createFakeWs = () => {
  const ws = new EventEmitter() as unknown as WebSocket;
  const closeMock = vi.fn();
  ws.close = closeMock;
  return { ws, closeMock };
};

describe('collaborationWSHandler', () => {
  test('forwards the connection to hocuspocus', () => {
    const { ws } = createFakeWs();
    const req = {} as Request;

    collaborationWSHandler(ws, req);

    expect(handleConnectionMock).toHaveBeenCalledWith(ws, req);
  });

  test('does not crash the process when the socket emits an unexpected "error" event', () => {
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { ws } = createFakeWs();

    collaborationWSHandler(ws, {} as Request);

    const wsError = Object.assign(new Error('Invalid WebSocket frame'), {
      code: 'WS_ERR_UNEXPECTED_RSV_2_3',
    });

    // Without an 'error' listener, EventEmitter would throw here and crash
    // the process - this call must not throw.
    expect(() => ws.emit('error', wsError)).not.toThrow();

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'WebSocket connection error:',
      wsError,
    );

    consoleErrorMock.mockRestore();
  });

  test('closes the socket and logs if handleConnection throws synchronously', () => {
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('boom');
    handleConnectionMock.mockImplementationOnce(() => {
      throw error;
    });

    const { ws, closeMock } = createFakeWs();
    collaborationWSHandler(ws, {} as Request);

    expect(closeMock).toHaveBeenCalled();
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to handle WebSocket connection:',
      error,
    );

    consoleErrorMock.mockRestore();
  });
});
