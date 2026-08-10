import { renderHook } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { useUploadFile } from '../useUploadFile';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

const MAX_FILE_SIZE = 1024;

vi.mock('@gouvfr-lasuite/cunningham-react', async () => {
  const actual = await vi.importActual<any>('@gouvfr-lasuite/cunningham-react');
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

describe('useUploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    );
  });
});
