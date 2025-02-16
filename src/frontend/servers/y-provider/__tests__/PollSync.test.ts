/* eslint-disable @typescript-eslint/no-require-imports */
import { EventEmitter } from 'events';

import { MessageType } from '@hocuspocus/server';
import { Response } from 'express';
import * as Y from 'yjs';

import { PollSync, PollSyncRequest } from '../src/libs/PollSync';

const { base64ToYDoc } = require('@/utils');
const { logger } = require('@/utils');

const mockEncodeStateAsUpdate = jest.fn();
jest.mock('yjs', () => ({
  ...jest.requireActual('yjs'),
  encodeStateAsUpdate: () => mockEncodeStateAsUpdate(),
}));

jest.mock('@/utils', () => ({
  base64ToYDoc: jest.fn((_b64: string) => new Y.Doc()),
  toBase64: jest.fn((data: Uint8Array) => Buffer.from(data).toString('base64')),
  logger: jest.fn(),
}));

jest.mock('@hocuspocus/server', () => {
  const originalModule = jest.requireActual('@hocuspocus/server');
  return {
    __esModule: true,
    ...originalModule,
    IncomingMessage: jest.fn().mockImplementation((buf: Buffer) => ({
      buffer: buf,
      readVarString: jest.fn(() => 'testRoom'),
      readVarUint: jest.fn(() => MessageType.Sync),
      writeVarUint: jest.fn(),
      decoder: {},
      encoder: {},
    })),
  };
});

describe('PollSync', () => {
  let req: PollSyncRequest<any>;
  let res: Response;
  let dummyDoc: any;
  let pollSync: PollSync<any>;
  let mockHocuspocusServer: any;

  beforeEach(() => {
    req = Object.assign(new EventEmitter(), {
      on: jest.fn((event, cb) => {
        // For 'close' event, store the callback for manual trigger in tests.
        if (event === 'close') {
          req.destroy = cb;
        }
      }),
    }) as unknown as PollSyncRequest<any>;

    res = {
      write: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    // Create a dummy document with required methods/properties
    dummyDoc = {
      name: 'testRoom',
      merge: jest.fn((_other: Y.Doc) => {
        // Simulate merging by returning a new Y.Doc instance
        return new Y.Doc();
      }),
      getConnections: jest.fn(() => [{ handleMessage: jest.fn() }]),
      awareness: {
        on: jest.fn(),
        off: jest.fn(),
      },
      addDirectConnection: jest.fn(),
      removeDirectConnection: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };

    pollSync = new PollSync(req, 'testRoom', true);
    // Pre-set the document for non-init tests
    (pollSync as any)._hpDocument = dummyDoc;

    // Create a dummy Hocuspocus server
    mockHocuspocusServer = {
      loadingDocuments: { get: jest.fn() },
      documents: new Map<string, any>(),
      createDocument: jest.fn(() => ({
        name: 'newDoc',
        merge: (doc: Y.Doc) => doc,
      })),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initHocuspocusDocument', () => {
    it('should return document from loadingDocuments when available', async () => {
      mockHocuspocusServer.loadingDocuments.get.mockResolvedValue(dummyDoc);
      pollSync = new PollSync(req, 'testRoom', true);
      const doc = await pollSync.initHocuspocusDocument(mockHocuspocusServer);
      expect(doc).toBe(dummyDoc);
      expect(mockHocuspocusServer.loadingDocuments.get).toHaveBeenCalledWith(
        'testRoom',
      );
    });

    it('should return document from documents when available', async () => {
      mockHocuspocusServer.loadingDocuments.get.mockResolvedValue(undefined);
      mockHocuspocusServer.documents.set('testRoom', dummyDoc);
      pollSync = new PollSync(req, 'testRoom', false);
      const doc = await pollSync.initHocuspocusDocument(mockHocuspocusServer);
      expect(doc).toBe(dummyDoc);
    });

    it('should create a new document when none exists and canEdit is true', async () => {
      mockHocuspocusServer.loadingDocuments.get.mockResolvedValue(undefined);
      pollSync = new PollSync(req, 'testRoom', true);
      const newDoc = { name: 'newDoc', merge: (doc: any) => doc };
      mockHocuspocusServer.createDocument.mockResolvedValue(newDoc);
      const doc = await pollSync.initHocuspocusDocument(mockHocuspocusServer);
      expect(doc).toBe(newDoc);
      expect(mockHocuspocusServer.createDocument).toHaveBeenCalled();
    });
  });

  describe('sync', () => {
    it('should encode state without merging when canEdit is false', () => {
      // When user cannot edit, merge should not be called.
      pollSync = new PollSync(req, 'testRoom', false);
      (pollSync as any)._hpDocument = dummyDoc;
      mockEncodeStateAsUpdate.mockReturnValue(Uint8Array.from([1, 2, 3]));

      const result = pollSync.sync('dummyLocalDoc64');
      expect(dummyDoc.merge).not.toHaveBeenCalled();
      expect(result).toBe(
        Buffer.from(Uint8Array.from([1, 2, 3])).toString('base64'),
      );
    });

    it('should merge local doc when canEdit is true', () => {
      pollSync = new PollSync(req, 'testRoom', true);
      (pollSync as any)._hpDocument = dummyDoc;
      const localDoc = new Y.Doc();
      // Mock base64ToYDoc to return our localDoc
      base64ToYDoc.mockReturnValue(localDoc);
      mockEncodeStateAsUpdate.mockReturnValue(Uint8Array.from([4, 5, 6]));
      pollSync.sync('localDoc64');
      expect(dummyDoc.merge).toHaveBeenCalledWith(localDoc);
    });
  });

  describe('sendClientsMessages', () => {
    it('should log an error if room names do not match', () => {
      // Set doc name different from what IncomingMessage returns ('testRoom')
      dummyDoc.name = 'differentRoom';
      (pollSync as any)._hpDocument = dummyDoc;
      const fakeMessage = Buffer.from('fakeMessage').toString('base64');
      pollSync.sendClientsMessages(fakeMessage);
      expect(logger).toHaveBeenCalled();
    });
  });

  describe('pullClientsMessages', () => {
    it('should register event listeners and cleanup on request close', () => {
      (pollSync as any)._hpDocument = dummyDoc;
      pollSync.pullClientsMessages(res);
      expect(dummyDoc.addDirectConnection).toHaveBeenCalled();
      expect(dummyDoc.on).toHaveBeenCalled();
      expect(dummyDoc.awareness.on).toHaveBeenCalled();

      // Simulate a 'close' event on the request
      if (req.destroy) {
        req.destroy();
      }
      expect(dummyDoc.removeDirectConnection).toHaveBeenCalled();
      // Verify that document listeners are removed (off was called)
      expect(dummyDoc.off).toHaveBeenCalled();
      expect(dummyDoc.awareness.off).toHaveBeenCalled();
    });
  });
});
