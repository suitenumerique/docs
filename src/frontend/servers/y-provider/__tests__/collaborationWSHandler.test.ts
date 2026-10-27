import { EventEmitter } from 'node:events';

import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { WebSocket } from 'ws';

vi.mock('@/servers/hocuspocusServer', () => ({
  hocuspocusServer: {
    hocuspocus: {
      handleConnection: vi.fn(),
    },
  },
}));

vi.mock('@/servers/relayServer', () => ({
  handleRelayServerConnection: vi.fn(),
}));

vi.mock('@/api/collaborationBackend', () => ({
  fetchCurrentUser: vi.fn(),
  fetchDocument: vi.fn(),
}));

import * as CollaborationBackend from '@/api/collaborationBackend';
import { collaborationWSHandler } from '@/handlers/collaborationWSHandler';
import { hocuspocusServer } from '@/servers/hocuspocusServer';
import { handleRelayServerConnection } from '@/servers/relayServer';

const handleConnectionMock = vi.spyOn(
  hocuspocusServer.hocuspocus,
  'handleConnection',
);

const createFakeWs = () => {
  const ws = new EventEmitter() as unknown as WebSocket;
  const closeMock = vi.fn();
  const sendMock = vi.fn();
  ws.close = closeMock;
  ws.send = sendMock;
  return { ws, closeMock, sendMock };
};

const createRequest = (room: string) =>
  ({
    url: `/collaboration/ws/?room=${room}`,
    headers: { cookie: 'docs_sessionid=abc' },
  }) as unknown as Request;

const mockDocument = (isEncrypted: boolean) => {
  vi.mocked(CollaborationBackend.fetchDocument).mockResolvedValue({
    is_encrypted: isEncrypted,
    abilities: { retrieve: true, update: true },
  } as Awaited<ReturnType<typeof CollaborationBackend.fetchDocument>>);
  vi.mocked(CollaborationBackend.fetchCurrentUser).mockResolvedValue({
    id: 'user-id',
  } as Awaited<ReturnType<typeof CollaborationBackend.fetchCurrentUser>>);
};

describe('collaborationWSHandler', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('forwards a plain document connection to hocuspocus', async () => {
    mockDocument(false);
    const room = uuidv4();
    const { ws } = createFakeWs();
    const req = createRequest(room);

    await collaborationWSHandler(ws, req);

    expect(CollaborationBackend.fetchDocument).toHaveBeenCalledWith(
      { name: room },
      req.headers,
    );
    expect(handleConnectionMock).toHaveBeenCalledWith(ws, req, {
      roomId: room,
      readOnly: false,
      sessionKey: 'abc',
      userId: 'user-id',
    });
    expect(handleRelayServerConnection).not.toHaveBeenCalled();
  });

  test('forwards an encrypted document connection to the relay', async () => {
    mockDocument(true);
    handleConnectionMock.mockClear();
    const room = uuidv4();
    const { ws, sendMock } = createFakeWs();

    await collaborationWSHandler(ws, createRequest(room));

    expect(sendMock).toHaveBeenCalledWith('system:authenticated');
    expect(handleRelayServerConnection).toHaveBeenCalledWith(
      ws,
      room,
      'user-id',
    );
    expect(handleConnectionMock).not.toHaveBeenCalled();
  });

  test('closes the socket and logs if handleConnection throws synchronously', async () => {
    mockDocument(false);
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('boom');
    handleConnectionMock.mockImplementationOnce(() => {
      throw error;
    });

    const { ws, closeMock } = createFakeWs();
    await collaborationWSHandler(ws, createRequest(uuidv4()));

    expect(closeMock).toHaveBeenCalledWith(1011, 'internal error');
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to handle WebSocket connection:',
      error,
    );

    consoleErrorMock.mockRestore();
  });

  test.each([
    ['not a uuid', 'not-a-uuid'],
    ['not a uuid v4', 'c8c1b4b0-6b1f-11ee-8c99-0242ac120002'],
  ])('refuses a room that is %s', async (_label, room) => {
    const { ws, closeMock } = createFakeWs();

    await collaborationWSHandler(ws, createRequest(room));

    expect(CollaborationBackend.fetchDocument).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledWith(1008, 'unauthorized');
  });

  test('refuses a user the backend denies the document to', async () => {
    vi.mocked(CollaborationBackend.fetchDocument).mockRejectedValue(
      new Error('403'),
    );
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { ws, closeMock } = createFakeWs();

    await collaborationWSHandler(ws, createRequest(uuidv4()));

    expect(closeMock).toHaveBeenCalledWith(1011, 'internal error');
    expect(handleConnectionMock).not.toHaveBeenCalled();
    consoleErrorMock.mockRestore();
  });

  test('refuses a user without the retrieve ability', async () => {
    vi.mocked(CollaborationBackend.fetchDocument).mockResolvedValue({
      is_encrypted: false,
      abilities: { retrieve: false, update: false },
    } as Awaited<ReturnType<typeof CollaborationBackend.fetchDocument>>);
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { ws, closeMock } = createFakeWs();

    await collaborationWSHandler(ws, createRequest(uuidv4()));

    expect(closeMock).toHaveBeenCalledWith(1008, 'unauthorized');
    expect(handleConnectionMock).not.toHaveBeenCalled();
    consoleErrorMock.mockRestore();
  });

  test('opens a plain document read-only without the update ability, and without a user id when there is no user', async () => {
    vi.mocked(CollaborationBackend.fetchDocument).mockResolvedValue({
      is_encrypted: false,
      abilities: { retrieve: true, update: false },
    } as Awaited<ReturnType<typeof CollaborationBackend.fetchDocument>>);
    vi.mocked(CollaborationBackend.fetchCurrentUser).mockRejectedValue(
      new Error('401'),
    );
    handleConnectionMock.mockClear();
    const room = uuidv4();
    const { ws } = createFakeWs();
    const req = createRequest(room);

    await collaborationWSHandler(ws, req);

    expect(handleConnectionMock).toHaveBeenCalledWith(ws, req, {
      roomId: room,
      readOnly: true,
      sessionKey: 'abc',
    });
  });
});
