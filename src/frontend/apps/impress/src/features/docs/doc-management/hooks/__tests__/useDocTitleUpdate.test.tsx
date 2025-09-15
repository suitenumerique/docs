import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { Doc } from '../../types';
import { useDocTitleUpdate } from '../useDocTitleUpdate';

// Mock useBroadcastStore
vi.mock('@/stores', () => ({
  useBroadcastStore: () => ({
    broadcast: vi.fn(),
  }),
}));

describe('useDocTitleUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.restore();
  });

  it('should return the correct functions and state', () => {
    const { result } = renderHook(() => useDocTitleUpdate(), {
      wrapper: AppWrapper,
    });

    expect(result.current.updateDocTitle).toBeDefined();
    expect(result.current.updateDocEmoji).toBeDefined();
    expect(typeof result.current.updateDocTitle).toBe('function');
    expect(typeof result.current.updateDocEmoji).toBe('function');
  });

  describe('updateDocTitle', () => {
    it('should call updateDoc with sanitized title', async () => {
      fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
        body: JSON.stringify({
          id: 'test-doc-id',
          title: 'My Document',
        }),
      });

      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: AppWrapper,
      });

      const sanitizedTitle = result.current.updateDocTitle(
        { id: 'test-doc-id', title: '' } as Doc,
        '  My Document  \n\r',
      );

      expect(sanitizedTitle).toBe('My Document');

      await waitFor(() => {
        expect(fetchMock.calls().length).toBe(1);
      });
      expect(fetchMock.calls()[0][0]).toBe(
        'http://test.jest/api/v1.0/documents/test-doc-id/',
      );
      expect(fetchMock.calls()[0][1]).toEqual({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ title: 'My Document' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should handle empty title and not call updateDoc', async () => {
      fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
        body: JSON.stringify({
          id: 'test-doc-id',
          title: 'My Document',
        }),
      });

      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: AppWrapper,
      });

      const sanitizedTitle = result.current.updateDocTitle(
        { id: 'test-doc-id', title: '' } as Doc,
        '',
      );

      expect(sanitizedTitle).toBe('');

      await waitFor(() => {
        expect(fetchMock.calls().length).toBe(0);
      });
    });

    it('should remove newlines and carriage returns', async () => {
      fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
        body: JSON.stringify({
          id: 'test-doc-id',
          title: 'My Document',
        }),
      });

      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: AppWrapper,
      });

      const sanitizedTitle = result.current.updateDocTitle(
        { id: 'test-doc-id', title: '' } as Doc,
        'Title\nwith\r\nnewlines',
      );

      expect(sanitizedTitle).toBe('Titlewithnewlines');

      await waitFor(() => {
        expect(fetchMock.calls().length).toBe(1);
      });
    });
  });

  describe('updateDocEmoji', () => {
    it('should call updateDoc with emoji and title without existing emoji', async () => {
      fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
        body: JSON.stringify({
          id: 'test-doc-id',
          title: 'My Document',
        }),
      });

      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: AppWrapper,
      });

      result.current.updateDocEmoji('test-doc-id', 'My Document', '🚀');

      await waitFor(() => {
        expect(fetchMock.calls().length).toBe(1);
      });
      expect(fetchMock.calls()[0][0]).toBe(
        'http://test.jest/api/v1.0/documents/test-doc-id/',
      );
      expect(fetchMock.calls()[0][1]).toEqual({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ title: '🚀 My Document' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should replace existing emoji with new one', async () => {
      fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
        body: JSON.stringify({
          id: 'test-doc-id',
          title: 'My Document',
        }),
      });

      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: AppWrapper,
      });

      result.current.updateDocEmoji('test-doc-id', '📝 My Document', '🚀');

      await waitFor(() => {
        expect(fetchMock.calls().length).toBe(1);
      });
      expect(fetchMock.calls()[0][1]).toEqual({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ title: '🚀 My Document' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should handle title with only emoji', async () => {
      fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
        body: JSON.stringify({
          id: 'test-doc-id',
          title: 'My Document',
        }),
      });

      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: AppWrapper,
      });

      result.current.updateDocEmoji('test-doc-id', '📝', '🚀');

      await waitFor(() => {
        expect(fetchMock.calls().length).toBe(1);
      });
      expect(fetchMock.calls()[0][1]).toEqual({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ title: '🚀 ' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should handle empty title', async () => {
      fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
        body: JSON.stringify({
          id: 'test-doc-id',
          title: 'My Document',
        }),
      });

      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: AppWrapper,
      });

      result.current.updateDocEmoji('test-doc-id', '', '🚀');

      await waitFor(() => {
        expect(fetchMock.calls().length).toBe(1);
      });
      expect(fetchMock.calls()[0][1]).toEqual({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ title: '🚀 ' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('onSuccess callback', () => {
    it('should call onSuccess when provided', async () => {
      fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
        body: JSON.stringify({
          id: 'test-doc-id',
          title: 'Updated Document',
        }),
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useDocTitleUpdate({ onSuccess }), {
        wrapper: AppWrapper,
      });

      result.current.updateDocTitle(
        { id: 'test-doc-id', title: 'Old Document' } as Doc,
        'Updated Document',
      );

      await waitFor(() => {
        expect(fetchMock.calls().length).toBe(1);
      });

      expect(onSuccess).toHaveBeenCalledWith({
        id: 'test-doc-id',
        title: 'Updated Document',
      });
    });
  });

  describe('onError callback', () => {
    it('should call onError when provided', async () => {
      fetchMock.patch('http://test.jest/api/v1.0/documents/test-doc-id/', {
        throws: new Error('Update failed'),
      });

      const onError = vi.fn();
      const { result } = renderHook(() => useDocTitleUpdate({ onError }), {
        wrapper: AppWrapper,
      });

      try {
        result.current.updateDocTitle(
          { id: 'test-doc-id', title: 'Old Document' } as Doc,
          'Updated Document',
        );
      } catch {
        expect(fetchMock.calls().length).toBe(1);
        expect(onError).toHaveBeenCalledWith(new Error('Update failed'));
      }
    });
  });
});
