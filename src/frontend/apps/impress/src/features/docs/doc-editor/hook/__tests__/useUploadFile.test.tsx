import { renderHook } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APIError } from '@/api';
import { AppWrapper } from '@/tests/utils';

import { useUploadFile } from '../useUploadFile';

vi.mock('@/core', () => ({
  useConfig: () => ({
    data: { DOCUMENT_IMAGE_MAX_SIZE: 1 }, // 1 byte limit for test
  }),
}));

describe('useUploadFile', () => {
  // Fake file with a size slightly under the limit
  const smallFile = new File(
    [new ArrayBuffer(1 * 1024 * 1024 - 1)],
    'big.png',
    {
      type: 'image/png',
    },
  );
  // Fake file with a size slightly over the limit
  const bigFile = new File([new ArrayBuffer(1 * 1024 * 1024 + 1)], 'big.png', {
    type: 'image/png',
  });

  beforeEach(() => {
    fetchMock.restore();
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
    expect(fetchMock.calls()).toHaveLength(1);
  });

  it('throws an APIError before uploading when file exceeds the size limit', async () => {
    const { result } = renderHook(() => useUploadFile('doc-id'), {
      wrapper: AppWrapper,
    });

    // Fake 2 bytes file
    const bigFile = new File([new ArrayBuffer(2)], 'big.png', {
      type: 'image/png',
    });

    await expect(result.current.uploadFile(bigFile)).rejects.toThrow(APIError);
    expect(fetchMock.calls()).toHaveLength(0);
  });
});
