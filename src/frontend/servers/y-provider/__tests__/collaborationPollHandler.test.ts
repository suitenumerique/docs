import { Response } from 'express';

import {
  collaborationPollPostMessageHandler,
  collaborationPollSSEMessageHandler,
  collaborationPollSyncDocHandler,
} from '../src/handlers/collaborationPollHandler';

const mockInitHocuspocusDocument = jest.fn();
const mockSendClientsMessages = jest.fn();
const mockSync = jest.fn();
const mockPullClientsMessages = jest.fn();

jest.mock('@/libs/PollSync', () => {
  return {
    PollSync: jest.fn().mockImplementation(() => ({
      initHocuspocusDocument: mockInitHocuspocusDocument,
      sendClientsMessages: mockSendClientsMessages,
      sync: mockSync,
      pullClientsMessages: mockPullClientsMessages,
    })),
  };
});

jest.mock('@/servers/hocusPocusServer', () => ({
  hocusPocusServer: {},
}));

// Helper function to create a mock response
function createResponse<T>() {
  const res: Partial<Response<T>> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.write = jest.fn();
  res.headersSent = false;
  return res as Response<T>;
}

describe('collaborationPollPostMessageHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitHocuspocusDocument.mockResolvedValue({ doc: 'exists' });
  });

  it('should return 403 if user is not allowed to edit', async () => {
    const req = {
      query: { room: 'test-room' },
      headers: { 'x-can-edit': 'False' },
      body: { message64: 'testMessage' },
    } as any;
    const res = createResponse();
    await collaborationPollPostMessageHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  it('should return 400 if room is not provided', async () => {
    const req = {
      query: {},
      headers: { 'x-can-edit': 'True' },
      body: { message64: 'testMessage' },
    } as any;
    const res = createResponse();
    await collaborationPollPostMessageHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Room name not provided' });
  });

  it('should return 404 if document is not found', async () => {
    mockInitHocuspocusDocument.mockResolvedValue(null);
    const req = {
      query: { room: 'test-room' },
      headers: { 'x-can-edit': 'True' },
      body: { message64: 'testMessage' },
    } as any;
    const res = createResponse();
    res.headersSent = false;
    await collaborationPollPostMessageHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Document not found' });
  });

  it('should process message and return updated true when successful', async () => {
    // Reset headerSent to false to simulate a proper response
    const req = {
      query: { room: 'test-room' },
      headers: { 'x-can-edit': 'True' },
      body: { message64: 'testMessage' },
    } as any;
    const res = createResponse();
    res.headersSent = false;
    await collaborationPollPostMessageHandler(req, res);
    expect(mockSendClientsMessages).toHaveBeenCalledWith('testMessage');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ updated: true });
  });
});

describe('collaborationPollSyncDocHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitHocuspocusDocument.mockResolvedValue({ doc: 'exists' });
    mockSync.mockReturnValue('syncDocEncoded');
  });

  it('should return 400 if room is not provided', async () => {
    const req = {
      query: {},
      headers: { 'x-can-edit': 'True' },
      body: { localDoc64: 'localDocEncoded' },
    } as any;
    const res = createResponse();
    await collaborationPollSyncDocHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Room name not provided' });
  });

  it('should return 404 if document is not found', async () => {
    mockInitHocuspocusDocument.mockResolvedValue(null);
    const req = {
      query: { room: 'test-room' },
      headers: { 'x-can-edit': 'True' },
      body: { localDoc64: 'localDocEncoded' },
    } as any;
    const res = createResponse();
    await collaborationPollSyncDocHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Document not found' });
  });

  it('should sync document and return syncDoc64 when successful', async () => {
    const req = {
      query: { room: 'test-room' },
      headers: { 'x-can-edit': 'True' },
      body: { localDoc64: 'localDocEncoded' },
    } as any;
    const res = createResponse();
    res.headersSent = false;
    await collaborationPollSyncDocHandler(req, res);
    expect(mockSync).toHaveBeenCalledWith('localDocEncoded');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ syncDoc64: 'syncDocEncoded' });
  });
});

describe('collaborationPollSSEMessageHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitHocuspocusDocument.mockResolvedValue({ doc: 'exists' });
  });

  it('should return 400 if room is not provided', async () => {
    const req = {
      query: {},
      headers: { 'x-can-edit': 'True' },
    } as any;
    const res = createResponse();
    await collaborationPollSSEMessageHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Room name not provided' });
  });

  it('should return 404 if document is not found', async () => {
    mockInitHocuspocusDocument.mockResolvedValue(null);
    const req = {
      query: { room: 'test-room' },
      headers: { 'x-can-edit': 'True' },
    } as any;
    const res = createResponse();
    await collaborationPollSSEMessageHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Document not found' });
  });

  it('should set SSE headers and send connected message when successful', async () => {
    const req = {
      query: { room: 'test-room' },
      headers: { 'x-can-edit': 'True' },
    } as any;
    const res = createResponse();
    res.headersSent = false;
    await collaborationPollSSEMessageHandler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(res.write).toHaveBeenCalledWith(': connected\n\n');
    expect(mockPullClientsMessages).toHaveBeenCalledWith(res);
  });
});
