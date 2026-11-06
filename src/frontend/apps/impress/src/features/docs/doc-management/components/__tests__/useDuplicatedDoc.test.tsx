import { type TreeContextType } from '@gouvfr-lasuite/ui-components';
import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addDocToTree } from '@/docs/doc-tree/utils';
import { AppWrapper } from '@/tests/utils';

import { Doc } from '../../types';
import { useDuplicatedDoc } from '../ConfirmationDuplicateModal';

const pushMock = vi.fn();
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: pushMock,
    pathname: '/',
  }),
}));

const toastMock = vi.fn();
vi.mock('@gouvfr-lasuite/ui-components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gouvfr-lasuite/ui-components')>()),
  useToastProvider: () => ({ toast: toastMock }),
}));

vi.mock('@/docs/doc-tree/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/docs/doc-tree/utils')>()),
  addDocToTree: vi.fn(),
}));

describe('useDuplicatedDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  // An editor of a sub-doc gets the copy beside it only when they may create
  // children in its parent: the response, not the abilities on the sub-doc,
  // tells where the copy landed.
  it.each([
    ['beside the sub-doc', 2, true],
    ['as a new root', 1, false],
  ])(
    'adds the copy of a sub-doc to the tree only when it lands %s',
    async (_label, copyDepth, isInTree) => {
      fetchMock.post(
        'http://test.jest/api/v1.0/documents/child-id/duplicate/',
        {
          status: 201,
          body: { id: 'copy-id', title: 'Child (copy)', depth: copyDepth },
        },
      );

      const doc = {
        id: 'child-id',
        depth: 2,
        abilities: { partial_update: true },
      } as Doc;
      const treeContext = {} as TreeContextType<Doc | null>;

      const { result } = renderHook(
        () => useDuplicatedDoc({ doc, treeContext }),
        { wrapper: AppWrapper },
      );
      result.current.mutate({ docId: doc.id, canSave: true });

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/docs/copy-id');
      });
      if (isInTree) {
        expect(addDocToTree).toHaveBeenCalledWith(
          treeContext,
          doc.id,
          expect.objectContaining({ id: 'copy-id' }),
        );
      } else {
        expect(addDocToTree).not.toHaveBeenCalled();
      }
      // The undo action of the toast removes the copy from the tree only if
      // it was added to it.
      const { actions } = toastMock.mock.calls[0][2] as {
        actions: ReactElement<{ isInTree: boolean }>;
      };
      expect(actions.props.isInTree).toBe(isInTree);
    },
  );
});
