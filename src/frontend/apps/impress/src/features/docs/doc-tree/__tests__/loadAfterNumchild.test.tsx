import {
  CunninghamProvider,
  TreeContextType,
  TreeProvider,
  useTreeContext,
} from '@gouvfr-lasuite/ui-components';
import { act, renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Doc } from '../../doc-management';
import { addToNumchildInTree } from '../utils';

const buildDoc = (id: string, numchild: number, children: Doc[] = []) =>
  ({ id, numchild, childrenCount: numchild, children }) as unknown as Doc;

describe('loading the children of a doc after incrementing its numchild', () => {
  it('keeps the new numchild once the children are loaded', async () => {
    const onLoadChildren = vi.fn().mockResolvedValue({
      children: [buildDoc('child', 0)],
      pagination: { currentPage: 1, hasMore: false },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <CunninghamProvider theme="default">
        <TreeProvider initialTreeData={[]} onLoadChildren={onLoadChildren}>
          {children}
        </TreeProvider>
      </CunninghamProvider>
    );
    const { result } = renderHook(
      () => useTreeContext<Doc>() as TreeContextType<Doc>,
      { wrapper },
    );

    const parent = buildDoc('parent', 0);
    act(() => {
      result.current.setRoot(buildDoc('root', 1, [parent]));
      result.current.treeData.resetTree([parent]);
    });

    // What creating a first sub-doc from a tree item does: `useCreateChildDoc`
    // increments the parent, then `afterCreate` loads its children, both from
    // the same render of the tree.
    const treeContext = result.current;
    await act(async () => {
      addToNumchildInTree(treeContext, 'parent', 1);
      await treeContext.treeData.handleLoadChildren('parent');
    });

    const node = result.current.treeData.getNode('parent') as Doc | undefined;
    expect(node?.numchild).toBe(1);
  });
});
