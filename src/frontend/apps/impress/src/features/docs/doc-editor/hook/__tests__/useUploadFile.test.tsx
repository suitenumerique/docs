import { renderHook } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsOffline } from '@/features/service-worker/hooks/useOffline';
import { AppWrapper } from '@/tests/utils';

import { DocsBlockNoteEditor } from '../../types';
import { useUploadFile, useUploadStatus } from '../useUploadFile';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

const MAX_FILE_SIZE = 1024;

vi.mock('@gouvfr-lasuite/ui-components', async () => {
  const actual = await vi.importActual<any>('@gouvfr-lasuite/ui-components');
  return {
    ...actual,
    useToastProvider: () => ({ toast: mockToast }),
  };
});

vi.mock('@/core', async () => {
  const actual = await vi.importActual<any>('@/core');
  return {
    ...actual,
    useConfig: () => ({ data: { DOCUMENT_IMAGE_MAX_SIZE: MAX_FILE_SIZE } }),
  };
});

const docId = 'test-doc-id';
const uploadUrl = `http://test.jest/api/v1.0/documents/${docId}/attachment-upload/`;

const createFile = (size: number) =>
  new File(['a'.repeat(size)], 'video.mp4', { type: 'video/mp4' });

const OFFLINE_MESSAGE =
  "You're offline. Files can be added once you're back online.";

describe('useUploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    useIsOffline.setState({ isOffline: false });
    fetchMock.hardReset();
    fetchMock.mockGlobal();

    fetchMock.post(uploadUrl, {
      body: { file: `/media/${docId}/attachments/video.mp4` },
    });
  });

  const renderUseUploadFile = () =>
    renderHook(() => useUploadFile(docId), { wrapper: AppWrapper }).result;

  it('uploads a file below the size limit', async () => {
    const result = renderUseUploadFile();

    await expect(
      result.current.uploadFile(createFile(MAX_FILE_SIZE)),
    ).resolves.toContain(`/media/${docId}/attachments/video.mp4`);

    expect(fetchMock.callHistory.calls(uploadUrl).length).toBe(1);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('rejects a file above the size limit without calling the API', async () => {
    const result = renderUseUploadFile();

    await expect(
      result.current.uploadFile(createFile(MAX_FILE_SIZE + 1)),
    ).rejects.toThrow('File is too large');

    expect(fetchMock.callHistory.calls(uploadUrl).length).toBe(0);
    expect(mockToast).toHaveBeenCalledWith(
      'The file "video.mp4" is too large. Maximum file size is 1KB.',
      'error',
      { duration: 10000 },
    );
  });

  it('toasts the causes of the API and rethrows when the upload fails', async () => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.post(uploadUrl, {
      status: 400,
      body: { file: ['File type not allowed.'] },
    });

    const result = renderUseUploadFile();

    await expect(
      result.current.uploadFile(createFile(MAX_FILE_SIZE)),
    ).rejects.toThrow('Failed to upload on the doc');

    expect(mockToast).toHaveBeenCalledWith(
      'A problem occurred while uploading the file, cause: File type not allowed.',
      'error',
      { duration: 10000 },
    );
  });

  it('tells the user they are offline without calling the API', async () => {
    useIsOffline.setState({ isOffline: true });

    const result = renderUseUploadFile();

    await expect(
      result.current.uploadFile(createFile(MAX_FILE_SIZE)),
    ).rejects.toThrow('Offline');

    expect(fetchMock.callHistory.calls(uploadUrl).length).toBe(0);
    expect(mockToast).toHaveBeenCalledWith(OFFLINE_MESSAGE, 'error', {
      duration: 10000,
    });
  });

  it('tells the user they are offline when the connection drops during the upload', async () => {
    let onLine = true;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => onLine);

    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.post(uploadUrl, () => {
      onLine = false;

      return { status: 502, body: { error: 'Network is unavailable.' } };
    });

    const result = renderUseUploadFile();

    await expect(
      result.current.uploadFile(createFile(MAX_FILE_SIZE)),
    ).rejects.toThrow('Failed to upload on the doc');

    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(OFFLINE_MESSAGE, 'error', {
      duration: 10000,
    });
  });
});

describe('useUploadStatus', () => {
  // Mimics BlockNote: a depth-first traversal of the blocks and their children
  const mockEditor = (
    document: Record<string, unknown>[],
    methods: Record<string, unknown>,
  ) =>
    ({
      forEachBlock: (callback: (block: unknown) => boolean) => {
        const walk = (blocks: Record<string, unknown>[]): boolean =>
          blocks.every(
            (block) =>
              callback(block) &&
              walk((block.children as Record<string, unknown>[]) ?? []),
          );
        walk(document);
      },
      document,
      onUploadEnd: vi.fn(),
      ...methods,
    }) as unknown as DocsBlockNoteEditor;

  it('keeps the caption and alignment while the new file is analyzed', () => {
    const updateBlock = vi.fn();
    const editor = mockEditor(
      [
        {
          id: 'img',
          type: 'image',
          props: {
            url: 'https://docs.example/media-check/abc',
            name: 'photo.png',
            showPreview: true,
            caption: 'Pont Neuf',
            textAlignment: 'center',
          },
        },
      ],
      { updateBlock },
    );

    renderHook(() => useUploadStatus(editor), { wrapper: AppWrapper });

    expect(updateBlock).toHaveBeenCalledWith(
      'img',
      expect.objectContaining({
        type: 'uploadLoader',
        props: expect.objectContaining({
          blockUploadCaption: 'Pont Neuf',
          blockUploadTextAlignment: 'center',
        }),
      }),
    );
  });

  it('preserves the column layout when replacing a block with the upload loader', () => {
    const updateBlock = vi.fn();
    const replaceBlocks = vi.fn();
    const editor = mockEditor(
      [
        {
          id: 'img',
          type: 'image',
          props: {
            url: 'https://docs.example/media-check/abc',
            name: 'photo.png',
            showPreview: false,
            caption: '',
            textAlignment: 'left',
          },
        },
      ],
      { updateBlock, replaceBlocks },
    );

    renderHook(() => useUploadStatus(editor), { wrapper: AppWrapper });

    // updateBlock is used (not replaceBlocks) to avoid destroying column layouts
    expect(updateBlock).toHaveBeenCalled();
    expect(replaceBlocks).not.toHaveBeenCalled();
  });

  it('resumes the analysis of an image nested in a column', () => {
    const updateBlock = vi.fn();
    const editor = mockEditor(
      [
        {
          id: 'columns',
          type: 'columnList',
          props: {},
          children: [
            {
              id: 'column',
              type: 'column',
              props: {},
              children: [
                {
                  id: 'nested-img',
                  type: 'image',
                  props: {
                    url: 'https://docs.example/media-check/abc',
                    name: 'photo.png',
                    showPreview: true,
                    caption: '',
                    textAlignment: 'left',
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
      { updateBlock },
    );

    renderHook(() => useUploadStatus(editor), { wrapper: AppWrapper });

    expect(updateBlock).toHaveBeenCalledWith(
      'nested-img',
      expect.objectContaining({ type: 'uploadLoader' }),
    );
  });
});
