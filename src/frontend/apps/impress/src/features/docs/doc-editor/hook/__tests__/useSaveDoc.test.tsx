import { act, renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { useRouter } from 'next/router';
import * as Y from 'yjs';

import { AppWrapper } from '@/tests/utils';

import useSaveDoc from '../useSaveDoc';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/docs/doc-versioning', () => ({
  KEY_LIST_DOC_VERSIONS: 'test-key-list-doc-versions',
}));

jest.mock('@/docs/doc-management', () => ({
  useUpdateDoc: jest.requireActual('@/docs/doc-management/api/useUpdateDoc')
    .useUpdateDoc,
}));

describe('useSaveDoc', () => {
  const mockRouterEvents = {
    on: jest.fn(),
    off: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.restore();

    (useRouter as jest.Mock).mockReturnValue({
      events: mockRouterEvents,
    });
  });

  it('should setup event listeners on mount', () => {
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';

    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

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

  it('should not save when canSave is false', async () => {
    jest.useFakeTimers();
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
    });

    act(() => {
      // Now advance timers after state has updated
      jest.advanceTimersByTime(61000);
    });

    await waitFor(() => {
      expect(fetchMock.calls().length).toBe(0);
    });

    jest.useRealTimers();
  });

  it('should save when there are local changes', async () => {
    jest.useFakeTimers();
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
      // Now advance timers after state has updated
      jest.advanceTimersByTime(61000);
    });

    await waitFor(() => {
      expect(fetchMock.lastCall()?.[0]).toBe(
        'http://test.jest/api/v1.0/documents/test-doc-id/',
      );
    });

    jest.useRealTimers();
  });

  it('should not save when there are no local changes', async () => {
    jest.useFakeTimers();
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
      // Now advance timers after state has updated
      jest.advanceTimersByTime(61000);
    });

    await waitFor(() => {
      expect(fetchMock.calls().length).toBe(0);
    });

    jest.useRealTimers();
  });

  it('should cleanup event listeners on unmount', () => {
    const yDoc = new Y.Doc();
    const docId = 'test-doc-id';
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

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
