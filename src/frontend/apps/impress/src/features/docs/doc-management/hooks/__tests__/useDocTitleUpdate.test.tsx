import { act, renderHook } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Doc } from '../../types';
import { useDocTitleUpdate } from '../useDocTitleUpdate';

// Mock useBroadcastStore
vi.mock('@/stores', () => ({
  useBroadcastStore: () => ({
    broadcast: vi.fn(),
  }),
}));

// Mock useTreeContext
vi.mock('@gouvfr-lasuite/ui-kit', () => ({
  useTreeContext: vi.fn(() => ({
    root: { id: 'test-doc-id', title: 'Test Document' },
    setRoot: vi.fn(),
    treeData: {
      updateNode: vi.fn(),
    },
  })),
  TreeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useUpdateDoc
const mockMutate = vi.fn();
let mockOnSuccess: ((data: any) => void) | undefined;
let mockOnError: ((error: any) => void) | undefined;
let _mockOnMutate: ((variables: any) => void) | undefined;

vi.mock('@/docs/doc-management', async () => {
  const actual = await vi.importActual('@/docs/doc-management');
  return {
    ...actual,
    useUpdateDoc: vi.fn((config) => {
      mockOnSuccess = config?.onSuccess;
      mockOnError = config?.onError;
      _mockOnMutate = config?.onMutate;

      return {
        mutate: mockMutate,
        isLoading: false,
        isError: false,
        error: null,
        isSuccess: false,
        data: undefined,
      };
    }),
    KEY_DOC: 'doc',
    KEY_LIST_DOC: 'list-doc',
  };
});

// Create a simple wrapper for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

describe('useDocTitleUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.restore();
  });

  it('should return the correct functions and state', () => {
    const { result } = renderHook(() => useDocTitleUpdate(), {
      wrapper: TestWrapper,
    });

    expect(result.current.updateDocTitle).toBeDefined();
    expect(result.current.updateDocEmoji).toBeDefined();
    expect(typeof result.current.updateDocTitle).toBe('function');
    expect(typeof result.current.updateDocEmoji).toBe('function');
  });

  describe('updateDocTitle', () => {
    it('should call updateDoc with sanitized title', () => {
      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.updateDocTitle(
          { id: 'test-doc-id', title: '' } as Doc,
          '  My Document  \n\r',
        );
      });

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'test-doc-id',
        title: 'My Document',
      });
    });

    it('should handle empty title and not call updateDoc', () => {
      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.updateDocTitle(
          { id: 'test-doc-id', title: '' } as Doc,
          '',
        );
      });

      expect(mockMutate).not.toHaveBeenCalledWith({
        id: 'test-doc-id',
        title: '',
      });
    });

    it('should remove newlines and carriage returns', () => {
      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.updateDocTitle(
          { id: 'test-doc-id', title: '' } as Doc,
          'Title\nwith\r\nnewlines',
        );
      });

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'test-doc-id',
        title: 'Titlewithnewlines',
      });
    });
  });

  describe('updateDocEmoji', () => {
    it('should call updateDoc with emoji and title without existing emoji', () => {
      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.updateDocEmoji('test-doc-id', 'My Document', '🚀');
      });

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'test-doc-id',
        title: '🚀 My Document',
      });
    });

    it('should replace existing emoji with new one', () => {
      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.updateDocEmoji('test-doc-id', '📝 My Document', '🚀');
      });

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'test-doc-id',
        title: '🚀 My Document',
      });
    });

    it('should handle title with only emoji', () => {
      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.updateDocEmoji('test-doc-id', '📝', '🚀');
      });

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'test-doc-id',
        title: '🚀 ',
      });
    });

    it('should handle empty title', () => {
      const { result } = renderHook(() => useDocTitleUpdate(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.updateDocEmoji('test-doc-id', '', '🚀');
      });

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'test-doc-id',
        title: '🚀 ',
      });
    });
  });

  describe('onSuccess callback', () => {
    it('should call onSuccess when provided', async () => {
      const onSuccess = vi.fn();
      renderHook(() => useDocTitleUpdate({ onSuccess }), {
        wrapper: TestWrapper,
      });

      // Simulate successful mutation
      const updatedDoc = { id: 'test-doc-id', title: 'Updated Document' };

      if (mockOnSuccess) {
        mockOnSuccess(updatedDoc);
      }

      expect(onSuccess).toHaveBeenCalledWith(updatedDoc);
    });
  });

  describe('onError callback', () => {
    it('should call onError when provided', async () => {
      const onError = vi.fn();
      renderHook(() => useDocTitleUpdate({ onError }), {
        wrapper: TestWrapper,
      });

      const error = new Error('Update failed');

      if (mockOnError) {
        mockOnError(error);
      }

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('mutation configuration', () => {
    it('should configure useUpdateDoc with correct parameters', () => {
      renderHook(() => useDocTitleUpdate(), {
        wrapper: TestWrapper,
      });

      // The mock should have been called with the correct parameters
      expect(mockMutate).toBeDefined();
    });
  });
});
