import fetchMock from 'fetch-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocsThreadStore } from '../DocsThreadStore';
import { DocsThreadStoreAuth } from '../DocsThreadStoreAuth';

const BASE_URL = 'http://test.jest/api/v1.0';
const docId = 'test-doc-id';
const THREADS_URL = `${BASE_URL}/documents/${docId}/threads/`;
const threadUrl = (id: string) =>
  `${BASE_URL}/documents/${docId}/threads/${id}/`;

const makeThread = (id: string, comments: unknown[] | null = []) => ({
  id,
  created_at: '2025-12-04T08:10:47.976364Z',
  updated_at: '2025-12-04T08:10:47.976377Z',
  comments,
  resolved: false,
  metadata: {},
  abilities: {},
});

const makeComment = (id: string) => ({
  id,
  user: { full_name: 'Test User' },
  body: { type: 'doc', content: [] },
  created_at: '2025-12-04T08:10:47.976364Z',
  updated_at: '2025-12-04T08:10:47.976364Z',
  reactions: [],
  metadata: {},
  abilities: {},
});

describe('DocsThreadStore - Orphan Thread Handling', () => {
  let threadStore: DocsThreadStore;
  let mockAuth: DocsThreadStoreAuth;
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.reset();
    dispatchEventSpy = vi
      .spyOn(document, 'dispatchEvent')
      .mockReturnValue(true);

    // Default: empty thread list
    fetchMock.get(THREADS_URL, []);

    mockAuth = {
      canSee: true,
      canComment: true,
    } as unknown as DocsThreadStoreAuth;

    threadStore = new DocsThreadStore(docId, undefined, mockAuth);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.reset();
  });

  describe('initThreads()', () => {
    it('should store valid threads and ignore orphan threads', async () => {
      const validThread = makeThread('valid-1', [makeComment('c1')]);
      const orphanEmpty = makeThread('orphan-1', []);
      const orphanNull = makeThread('orphan-2', null);

      fetchMock.get(THREADS_URL, [validThread, orphanEmpty, orphanNull], {
        overwriteRoutes: true,
      });
      // initThreads calls deleteThread for orphans
      fetchMock.delete(threadUrl('orphan-1'), 204);
      fetchMock.delete(threadUrl('orphan-2'), 204);

      await threadStore.initThreads();

      const stored = threadStore.getThreads();
      expect(stored.size).toBe(1);
      expect(stored.has('valid-1')).toBe(true);
      expect(stored.has('orphan-1')).toBe(false);
      expect(stored.has('orphan-2')).toBe(false);
    });

    it('should delete orphan threads via the API', async () => {
      fetchMock.get(THREADS_URL, [makeThread('orphan-1', [])], {
        overwriteRoutes: true,
      });
      fetchMock.delete(threadUrl('orphan-1'), 204);

      await threadStore.initThreads();

      expect(
        fetchMock.called(threadUrl('orphan-1'), { method: 'DELETE' }),
      ).toBe(true);
    });

    it('should handle an empty thread list', async () => {
      fetchMock.get(THREADS_URL, [], { overwriteRoutes: true });

      await threadStore.initThreads();

      expect(threadStore.getThreads().size).toBe(0);
    });

    it('should throw when the API returns an error', async () => {
      fetchMock.get(
        THREADS_URL,
        { status: 500, body: {} },
        { overwriteRoutes: true },
      );

      await expect(threadStore.initThreads()).rejects.toThrow(
        'Failed to get threads in document',
      );
    });
  });

  describe('refreshThread()', () => {
    it('should delete an orphan thread (no comments) via the API', async () => {
      const threadId = 'orphan-thread';
      fetchMock.get(threadUrl(threadId), makeThread(threadId, []));
      fetchMock.delete(threadUrl(threadId), 204);

      await threadStore.refreshThread(threadId);

      expect(fetchMock.called(threadUrl(threadId), { method: 'DELETE' })).toBe(
        true,
      );
    });

    it('should store a valid thread (with comments) without deleting it', async () => {
      const threadId = 'valid-thread';
      const serverThread = makeThread(threadId, [makeComment('c1')]);
      fetchMock.get(threadUrl(threadId), serverThread);

      await threadStore.refreshThread(threadId);

      expect(fetchMock.called(threadUrl(threadId), { method: 'DELETE' })).toBe(
        false,
      );
      expect(threadStore.getThreads().has(threadId)).toBe(true);
    });

    it('should dispatch Escape and call refreshThreads on 404', async () => {
      const threadId = 'deleted-thread';
      fetchMock.get(threadUrl(threadId), 404);
      fetchMock.get(THREADS_URL, [], { overwriteRoutes: true });

      await threadStore.refreshThread(threadId);

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Escape' }),
      );
    });
  });

  describe('deleteComment()', () => {
    it('should delete the thread when the last comment is removed', async () => {
      const threadId = 'thread-1';
      const commentId = 'comment-1';

      // Seed the store with a thread that has one comment
      fetchMock.get(
        THREADS_URL,
        [makeThread(threadId, [makeComment(commentId)])],
        {
          overwriteRoutes: true,
        },
      );
      await threadStore.initThreads();

      fetchMock.delete(
        `${BASE_URL}/documents/${docId}/threads/${threadId}/comments/${commentId}/`,
        204,
      );
      fetchMock.delete(threadUrl(threadId), 204);

      await threadStore.deleteComment({ threadId, commentId });

      expect(fetchMock.called(threadUrl(threadId), { method: 'DELETE' })).toBe(
        true,
      );
      expect(threadStore.getThreads().has(threadId)).toBe(false);
    });

    it('should keep the thread when other comments remain after deletion', async () => {
      const threadId = 'thread-1';
      const commentToDelete = 'comment-1';

      fetchMock.get(
        THREADS_URL,
        [
          makeThread(threadId, [
            makeComment(commentToDelete),
            makeComment('comment-2'),
          ]),
        ],
        { overwriteRoutes: true },
      );
      await threadStore.initThreads();

      fetchMock.delete(
        `${BASE_URL}/documents/${docId}/threads/${threadId}/comments/${commentToDelete}/`,
        204,
      );

      await threadStore.deleteComment({ threadId, commentId: commentToDelete });

      expect(fetchMock.called(threadUrl(threadId), { method: 'DELETE' })).toBe(
        false,
      );
      expect(threadStore.getThreads().has(threadId)).toBe(true);
      expect(threadStore.getThreads().get(threadId)?.comments).toHaveLength(1);
    });
  });
});
