import { renderHook } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import type { Doc } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { useExportXL } from '../hooks/useExportXL';

const editorWithSubDocsBlock = {
  document: [
    {
      id: 'sub-docs',
      type: 'docChildren',
      props: {},
      content: undefined,
      children: [],
    },
  ],
} as unknown as DocsBlockNoteEditor;

describe('useExportXL', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.route('begin:http://test.jest/api/v1.0/', {
      results: [],
      next: null,
      count: 0,
    });
  });

  it.each(['markdown', 'html'])(
    'requests nothing for a %s export, which the export modal builds',
    async (format) => {
      const { result } = renderHook(
        () => useExportXL({ id: 'parent' } as Doc, editorWithSubDocsBlock),
        { wrapper: AppWrapper },
      );

      await expect(
        result.current.docToBlob(format, 'Title'),
      ).resolves.toBeUndefined();
      expect(fetchMock.callHistory.calls()).toHaveLength(0);
    },
  );
});
