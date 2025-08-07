import { act, renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { useRouter } from 'next/router';
import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';
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
    fetchMock.restore();

    (useRouter as Mock).mockReturnValue({
      events: mockRouterEvents,
    });
  });

  it('should setup event listeners on mount', () => {
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useSaveDoc(docId, yDoc, true, true), {
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

  it('should not save when canSave is false', () => {
    vi.useFakeTimers();
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';

    fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
      body: JSON.stringify({
        id: 'test-doc-id',
        content: 'test-content',
        title: 'test-title',
      }),
    });

    renderHook(() => useSaveDoc(docId, yDoc, false, true), {
      wrapper: AppWrapper,
    });

    act(() => {
      // Trigger a local update
      yDoc.getMap('test').set('key', 'value');

      // Advance timers to trigger the save interval
      vi.advanceTimersByTime(61000);
    });

    // Since canSave is false, no API call should be made
    expect(fetchMock.calls().length).toBe(0);

    vi.useRealTimers();
  });

  it('should save when there are local changes', async () => {
    vi.useFakeTimers();
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';

    fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
      body: JSON.stringify({
        id: 'test-doc-id',
        content: 'test-content',
        title: 'test-title',
      }),
    });

    renderHook(() => useSaveDoc(docId, yDoc, true, true), {
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
      expect(fetchMock.lastCall()?.[0]).toBe(
        'http://test.jest/api/v1.0/documents/test-doc-id/',
      );
    });
  });

  it('should not save when there are no local changes', () => {
    vi.useFakeTimers();
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';

    fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
      body: JSON.stringify({
        id: 'test-doc-id',
        content: 'test-content',
        title: 'test-title',
      }),
    });

    renderHook(() => useSaveDoc(docId, yDoc, true, true), {
      wrapper: AppWrapper,
    });

    act(() => {
      // Advance timers without triggering any local updates
      vi.advanceTimersByTime(61000);
    });

    // Since there are no local changes, no API call should be made
    expect(fetchMock.calls().length).toBe(0);

    vi.useRealTimers();
  });

  it('should cleanup event listeners on unmount', () => {
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useSaveDoc(docId, yDoc, true, true), {
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
