import { TreeContextType } from '@gouvfr-lasuite/ui-components';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Doc } from '../../doc-management';
import { addToNumchildInTree, updateNodeKeepingButtonFocus } from '../utils';

const setup = (numchild: number, isRoot: boolean) => {
  const parent = { id: 'parent-id', numchild } as Doc;
  const setRoot = vi.fn();
  const updateNode = vi.fn();
  const treeContext = {
    root: isRoot ? parent : { id: 'root-id', numchild: 1 },
    setRoot,
    treeData: {
      getNode: (id: string) => (id === parent.id ? parent : undefined),
      updateNode,
    },
    treeApiRef: { current: { focus: vi.fn() } },
  } as unknown as TreeContextType<Doc>;

  return { parent, setRoot, updateNode, treeContext };
};

describe('addToNumchildInTree', () => {
  it.each([
    ['the root', true],
    ['a node of the tree', false],
  ])('updates numchild of %s', (_label, isRoot) => {
    const { parent, setRoot, updateNode, treeContext } = setup(2, isRoot);

    addToNumchildInTree(treeContext, 'parent-id', -1);

    if (isRoot) {
      expect(setRoot).toHaveBeenCalledWith({ ...parent, numchild: 1 });
    } else {
      expect(updateNode).toHaveBeenCalledWith('parent-id', { numchild: 1 });
    }
  });

  it('updates the node in place, without updateNode, with keepFocus', () => {
    const { parent, updateNode, treeContext } = setup(2, false);

    addToNumchildInTree(treeContext, 'parent-id', 1, { keepFocus: true });

    expect(parent.numchild).toBe(3);
    expect(updateNode).not.toHaveBeenCalled();
  });

  it('never goes below 0', () => {
    const { updateNode, treeContext } = setup(0, false);

    addToNumchildInTree(treeContext, 'parent-id', -1);

    expect(updateNode).toHaveBeenCalledWith('parent-id', { numchild: 0 });
  });

  it('does nothing when the tree does not hold the doc', () => {
    const { setRoot, updateNode, treeContext } = setup(1, false);

    addToNumchildInTree(treeContext, 'unknown-id', 1);
    addToNumchildInTree(null, 'parent-id', 1);

    expect(setRoot).not.toHaveBeenCalled();
    expect(updateNode).not.toHaveBeenCalled();
  });
});

describe('updateNodeKeepingButtonFocus', () => {
  const renderItem = () => {
    document.body.innerHTML = `
      <a data-testid="doc-sub-page-item-doc-id">
        <button>emoji</button><button>options</button>
      </a>`;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('gives the focus back to the same button of the rebuilt item', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) =>
      callback(),
    );
    renderItem();
    const [, options] = document.querySelectorAll('button');
    options.focus();
    // The rebuild replaces the buttons by new ones
    const updateNode = vi.fn(renderItem);
    const treeContext = {
      treeData: { updateNode },
    } as unknown as TreeContextType<Doc>;

    updateNodeKeepingButtonFocus(treeContext, 'doc-id', { title: 'New' });

    expect(updateNode).toHaveBeenCalledWith('doc-id', { title: 'New' });
    expect(document.activeElement).not.toBe(options);
    expect(document.activeElement).toBe(document.querySelectorAll('button')[1]);
  });

  it('does not take the focus when the item did not hold it', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) =>
      callback(),
    );
    renderItem();
    const treeContext = {
      treeData: { updateNode: vi.fn(renderItem) },
    } as unknown as TreeContextType<Doc>;

    updateNodeKeepingButtonFocus(treeContext, 'doc-id', { title: 'New' });

    expect(document.activeElement).toBe(document.body);
  });
});
