import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { useUploadFile } from '../useUploadFile';

vi.mock('@/core', () => ({
  useConfig: () => ({
    data: { DOCUMENT_IMAGE_MAX_SIZE: 1 * 1024 * 1024 }, // 1MB limit for test
  }),
}));

describe('useUploadFile', () => {
  // Fake file with a size slightly under the limit
  const smallFile = new File(
    [new ArrayBuffer(1 * 1024 * 1024 - 1)],
    'small.png',
    {
      type: 'image/png',
    },
  );
  // Fake file with a size slightly over the limit
  const bigFile = new File([new ArrayBuffer(1 * 1024 * 1024 + 1)], 'big.png', {
    type: 'image/png',
  });

  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  it("proceeds to upload when file doesn't exceed the size limit", async () => {
    fetchMock.post(
      'http://test.jest/api/v1.0/documents/doc-id/attachment-upload/',
      { body: { file: '/media/test.jpg' } },
    );
    const { result } = renderHook(() => useUploadFile('doc-id'), {
      wrapper: AppWrapper,
    });

    await result.current.uploadFile(smallFile);
    expect(fetchMock.callHistory.calls()).toHaveLength(1);
  });

  it('throws an APIError before uploading when file exceeds the size limit', async () => {
    const { result } = renderHook(() => useUploadFile('doc-id'), {
      wrapper: AppWrapper,
    });

    await expect(result.current.uploadFile(bigFile)).rejects.toThrow();
    expect(fetchMock.callHistory.calls()).toHaveLength(0);
  });

  it('sets errorAttachment synchronously (before any network call) when file exceeds the size limit', async () => {
    const { result } = renderHook(() => useUploadFile('doc-id'), {
      wrapper: AppWrapper,
    });

    // Start the upload but do not await — error must be visible immediately
    const uploadPromise = result.current.uploadFile(bigFile).catch(() => {});

    await waitFor(() => {
      expect(result.current.isErrorAttachment).toBe(true);
    });

    expect(result.current.errorAttachment?.cause).toEqual([
      'File size exceeds the maximum allowed size of 1MB.',
    ]);
    expect(fetchMock.callHistory.calls()).toHaveLength(0);

    await uploadPromise;
  });
});
