import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { useImportDoc } from '../useImportDoc';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

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
    useConfig: () => ({
      data: { CONVERSION_FILE_EXTENSIONS_ALLOWED: ['.docx', '.md'] },
    }),
  };
});

const uploadUrl = 'http://test.jest/api/v1.0/documents/';
const createFile = () =>
  new File(['content'], 'my-document.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

describe('useImportDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  const renderUseImportDoc = () =>
    renderHook(() => useImportDoc(), { wrapper: AppWrapper }).result;

  it('shows an unsupported media type message on a 415 response', async () => {
    fetchMock.post(uploadUrl, { status: 415, body: {} });

    const result = renderUseImportDoc();
    result.current.mutate([createFile(), 'application/octet-stream']);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });

    expect(mockToast).toHaveBeenCalledWith(
      'The document "my-document.docx" import has failed (only .docx, .md files are allowed)',
      'error',
    );
  });

  it('shows an unprocessable content message on a 422 response', async () => {
    fetchMock.post(uploadUrl, { status: 422, body: {} });

    const result = renderUseImportDoc();
    result.current.mutate([createFile(), 'application/octet-stream']);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });

    expect(mockToast).toHaveBeenCalledWith(
      'The import of the document « my-document.docx » failed because something is wrong with the file.',
      'error',
    );
  });

  it('shows a technical issue message on a 500 response', async () => {
    fetchMock.post(uploadUrl, { status: 500, body: {} });

    const result = renderUseImportDoc();
    result.current.mutate([createFile(), 'application/octet-stream']);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });

    expect(mockToast).toHaveBeenCalledWith(
      'The import of the document « my-document.docx » failed due to a technical issue',
      'error',
    );
  });

  it('shows the generic message on other error statuses', async () => {
    fetchMock.post(uploadUrl, { status: 400, body: {} });

    const result = renderUseImportDoc();
    result.current.mutate([createFile(), 'application/octet-stream']);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });

    expect(mockToast).toHaveBeenCalledWith(
      'The document "my-document.docx" import has failed',
      'error',
    );
  });
});
