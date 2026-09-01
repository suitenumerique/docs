import { act, renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { useRouter } from 'next/router';
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { AppWrapper } from '@/tests/utils';

import { useSaveDoc } from '../useSaveDoc';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/docs/doc-versioning', () => ({
  KEY_LIST_DOC_VERSIONS: 'test-key-list-doc-versions',
}));

vi.mock('@/docs/doc-management', async () => ({
  useUpdateDoc: (
    await vi.importActual('@/docs/doc-management/api/useUpdateDoc')
  ).useUpdateDoc,
}));

describe('useSaveDoc', () => {
  const mockRouterEvents = {
    on: vi.fn(),
    off: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.hardReset();
    fetchMock.mockGlobal();

    (useRouter as Mock).mockReturnValue({
      events: mockRouterEvents,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should setup event listeners on mount', () => {
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useSaveDoc(docId, yDoc), {
      wrapper: AppWrapper,
    });

    // Verify router event listeners are set up
    expect(mockRouterEvents.on).toHaveBeenCalledWith(
      'routeChangeStart',
      expect.any(Function),
    );

    // Verify window event listener is set up
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );

    addEventListenerSpy.mockRestore();
  });

  it('should save when there are local changes', async () => {
    vi.useFakeTimers();
    const yDoc = new Y.Doc();
    const docId = self.crypto.randomUUID();

    fetchMock.patch(`http://test.jest/api/v1.0/documents/${docId}/content/`, {
      body: JSON.stringify({
        id: docId,
        content: 'test-content',
      }),
    });

    renderHook(() => useSaveDoc(docId, yDoc), {
      wrapper: AppWrapper,
    });

    act(() => {
      // Trigger a local update
      yDoc.getMap('test').set('key', 'value');
    });

    act(() => {
      // Advance timers to trigger the save interval
      vi.advanceTimersByTime(61000);
    });

    // Switch to real timers to allow the mutation promise to resolve
    vi.useRealTimers();

    await waitFor(() => {
      expect(fetchMock.callHistory.lastCall()?.url).toBe(
        `http://test.jest/api/v1.0/documents/${docId}/content/`,
      );
    });
  });

  it('should not save when there are no local changes', () => {
    vi.useFakeTimers();
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';

    fetchMock.patch(
      'http://test.jest/api/v1.0/documents/test-doc-id/content/',
      {
        body: JSON.stringify({
          id: 'test-doc-id',
          content: 'test-content',
        }),
      },
    );

    renderHook(() => useSaveDoc(docId, yDoc), {
      wrapper: AppWrapper,
    });

    act(() => {
      // Advance timers without triggering any local updates
      vi.advanceTimersByTime(61000);
    });

    // Since there are no local changes, no API call should be made
    expect(fetchMock.callHistory.calls().length).toBe(0);

    vi.useRealTimers();
  });

  const setupSavedDoc = async (yDoc: Y.Doc, docId: string) => {
    fetchMock.patch(`http://test.jest/api/v1.0/documents/${docId}/content/`, {
      body: JSON.stringify({ id: docId, content: 'test-content' }),
    });

    renderHook(() => useSaveDoc(docId, yDoc), {
      wrapper: AppWrapper,
    });

    act(() => {
      // Trigger a local update so there is something to save
      yDoc.getMap('test').set('key', 'value');
    });
  };

  const dispatchBeforeUnload = () => {
    const event = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  };

  it('should save with keepalive when the page is unloading', async () => {
    const yDoc = new Y.Doc();
    const docId = self.crypto.randomUUID();

    await setupSavedDoc(yDoc, docId);

    const event = dispatchBeforeUnload();

    await waitFor(() => {
      expect(fetchMock.callHistory.lastCall()?.url).toBe(
        `http://test.jest/api/v1.0/documents/${docId}/content/`,
      );
    });

    expect(fetchMock.callHistory.lastCall()?.options.keepalive).toBe(true);
    // The browser owns the request, no need to hold the unload back
    expect(event.defaultPrevented).toBe(false);
  });

  it('should not use keepalive when saving without unloading', async () => {
    vi.useFakeTimers();
    const yDoc = new Y.Doc();
    const docId = self.crypto.randomUUID();

    await setupSavedDoc(yDoc, docId);

    act(() => {
      vi.advanceTimersByTime(61000);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(fetchMock.callHistory.lastCall()?.url).toBe(
        `http://test.jest/api/v1.0/documents/${docId}/content/`,
      );
    });

    expect(fetchMock.callHistory.lastCall()?.options.keepalive).toBeFalsy();
  });

  it('should hold the unload back when the doc is too big for keepalive with firefox', async () => {
    const yDoc = new Y.Doc();
    const docId = self.crypto.randomUUID();

    // Mock Firefox user agent to simulate Firefox behavior
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
    );

    fetchMock.patch(`http://test.jest/api/v1.0/documents/${docId}/content/`, {
      body: JSON.stringify({ id: docId, content: 'test-content' }),
    });

    renderHook(() => useSaveDoc(docId, yDoc), {
      wrapper: AppWrapper,
    });

    act(() => {
      // Over the 64 KiB keepalive cap once base64 encoded
      yDoc.getText('big').insert(0, 'a'.repeat(70 * 1024));
    });

    const event = dispatchBeforeUnload();

    await waitFor(() => {
      expect(fetchMock.callHistory.lastCall()?.url).toBe(
        `http://test.jest/api/v1.0/documents/${docId}/content/`,
      );
    });

    expect(fetchMock.callHistory.lastCall()?.options.keepalive).toBe(false);
    // Regular fetch: the unload is held back so the request has time to go out
    expect(event.defaultPrevented).toBe(true);
  });

  it('should cleanup event listeners on unmount', () => {
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useSaveDoc(docId, yDoc), {
      wrapper: AppWrapper,
    });

    unmount();

    // Verify router event listeners are cleaned up
    expect(mockRouterEvents.off).toHaveBeenCalledWith(
      'routeChangeStart',
      expect.any(Function),
    );

    // Verify window event listener is cleaned up
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });
});
