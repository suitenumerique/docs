import { announce } from '@react-aria/live-announcer';
import { focusManager } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { DocChildrenList } from '../DocChildrenBlock';

vi.mock('@react-aria/live-announcer', () => ({ announce: vi.fn() }));

vi.mock('@/docs/doc-management', async () => {
  const actual = await vi.importActual('@/docs/doc-management');
  return {
    ...actual,
    useDocStore: (selector?: (state: unknown) => unknown) => {
      const state = { currentDoc: { id: 'parent' } };
      return selector ? selector(state) : state;
    },
  };
});

type Child = { id: string; title: string };
type FakeItem = { key: string; value: Child; children: FakeItem[] };
type FakeTree = {
  root: { id: string };
  treeData: { nodes: FakeItem[]; getNode: () => unknown };
};

let mockTree: FakeTree | null = null;

vi.mock('@/docs/doc-tree/utils', async () => ({
  ...(await vi.importActual('@/docs/doc-tree/utils')),
  useTreeContextOrNull: () => mockTree,
}));

/**
 * A sidebar tree whose root is the doc, holding the given sub-docs
 */
const treeOf = (children: Child[]): FakeTree => ({
  root: { id: 'parent' },
  treeData: {
    nodes: children.map((value) => ({ key: value.id, value, children: [] })),
    getNode: () => undefined,
  },
});

/**
 * A sidebar tree where the doc is a sub-doc of the root, holding the given
 * sub-docs. Like the real tree, the doc of its node keeps the sub-docs it was
 * loaded with: only the items follow the updates.
 */
const nestedTreeOf = (children: Child[]): FakeTree => ({
  root: { id: 'grandparent' },
  treeData: {
    nodes: [
      {
        key: 'parent',
        value: { id: 'parent', title: 'Parent' },
        children: children.map((value) => ({
          key: value.id,
          value,
          children: [],
        })),
      },
    ],
    getNode: () => ({ id: 'parent', title: 'Parent', children: [] }),
  },
});

let setHarnessTree: (tree: FakeTree | null) => void = () => {};

/**
 * Renders the given number of blocks along with a sidebar tree that the test
 * changes with `setHarnessTree`, without recreating the query client
 */
const Harness = ({ blocks = 1 }: { blocks?: number }) => {
  const [tree, setTree] = useState<FakeTree | null>(null);
  setHarnessTree = setTree;
  mockTree = tree;

  return (
    <>
      {Array.from({ length: blocks }, (_, index) => (
        <DocChildrenList key={index} isEditable />
      ))}
    </>
  );
};

vi.mock(
  '../../custom-inline-content/Mention/Interlinking/LinkSelected',
  () => ({
    LinkSelected: ({ doc }: { doc: { title: string } }) => (
      <span role="link" tabIndex={0}>
        {doc.title}
      </span>
    ),
  }),
);

const CHILDREN_URL =
  'begin:http://test.jest/api/v1.0/documents/parent/children/';

/**
 * Answers the children requests in order, one response per request
 */
const mockChildrenResponses = (
  ...responses: ({ id: string; title: string }[] | number)[]
) => {
  fetchMock.route(CHILDREN_URL, () => {
    const response = responses.shift() ?? [];
    return typeof response === 'number'
      ? response
      : { results: response, next: null, count: response.length };
  });
};

const childrenCalls = () => fetchMock.callHistory.calls(CHILDREN_URL).length;

/**
 * Hides then shows the tab, after the given time
 */
const regainFocusAfter = (ms: number) => {
  act(() => {
    focusManager.setFocused(false);
  });
  vi.setSystemTime(Date.now() + ms);
  act(() => {
    focusManager.setFocused(true);
  });
};

describe('DocChildrenList', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    mockTree = null;
    vi.mocked(announce).mockClear();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says so when the sub-docs cannot be loaded, and retries on demand', async () => {
    mockChildrenResponses(500, [{ id: 'child-1', title: 'Meeting notes' }]);

    render(<DocChildrenList isEditable />, { wrapper: AppWrapper });

    expect(
      await screen.findByText('The sub-docs could not be loaded.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Meeting notes')).toBeInTheDocument();
    expect(childrenCalls()).toBe(2);
  });

  it('refetches the sub-docs when the tab regains focus after 30 seconds', async () => {
    mockChildrenResponses(
      [{ id: 'child-1', title: 'Meeting notes' }],
      [
        { id: 'child-1', title: 'Meeting notes' },
        { id: 'child-2', title: 'Added by a colleague' },
      ],
    );

    render(<DocChildrenList isEditable />, { wrapper: AppWrapper });
    expect(await screen.findByText('Meeting notes')).toBeInTheDocument();

    regainFocusAfter(31_000);

    expect(await screen.findByText('Added by a colleague')).toBeInTheDocument();
    expect(childrenCalls()).toBe(2);
  });

  it('keeps the loaded list when a later refetch fails', async () => {
    mockChildrenResponses([{ id: 'child-1', title: 'Meeting notes' }], 503);

    render(<DocChildrenList isEditable />, { wrapper: AppWrapper });
    expect(await screen.findByText('Meeting notes')).toBeInTheDocument();

    regainFocusAfter(31_000);

    await waitFor(() => expect(childrenCalls()).toBe(2));
    expect(screen.getByText('Meeting notes')).toBeInTheDocument();
    expect(
      screen.queryByText('The sub-docs could not be loaded.'),
    ).not.toBeInTheDocument();
  });

  it('does not refetch the sub-docs when the tree loads them', async () => {
    mockChildrenResponses([{ id: 'child-1', title: 'Meeting notes' }]);

    render(<Harness />, { wrapper: AppWrapper });
    expect(await screen.findByText('Meeting notes')).toBeInTheDocument();

    act(() => {
      setHarnessTree(treeOf([{ id: 'child-1', title: 'Meeting notes' }]));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(childrenCalls()).toBe(1);
  });

  it('refetches the sub-docs once when the tree changes them, whatever the number of blocks', async () => {
    mockChildrenResponses(
      [{ id: 'child-1', title: 'Meeting notes' }],
      [
        { id: 'child-1', title: 'Meeting notes' },
        { id: 'child-2', title: 'Added from the tree' },
      ],
    );

    render(<Harness blocks={2} />, { wrapper: AppWrapper });
    act(() => {
      setHarnessTree(treeOf([{ id: 'child-1', title: 'Meeting notes' }]));
    });
    expect(await screen.findAllByText('Meeting notes')).toHaveLength(2);

    act(() => {
      setHarnessTree(
        treeOf([
          { id: 'child-1', title: 'Meeting notes' },
          { id: 'child-2', title: 'Added from the tree' },
        ]),
      );
    });

    expect(await screen.findAllByText('Added from the tree')).toHaveLength(2);
    expect(childrenCalls()).toBe(2);
  });

  it('does not refetch the sub-docs when the tab regains focus within 30 seconds', async () => {
    mockChildrenResponses([{ id: 'child-1', title: 'Meeting notes' }]);

    render(<DocChildrenList isEditable />, { wrapper: AppWrapper });
    expect(await screen.findByText('Meeting notes')).toBeInTheDocument();

    regainFocusAfter(10_000);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(childrenCalls()).toBe(1);
  });

  it('exposes the sub-docs as a named list', async () => {
    mockChildrenResponses([
      { id: 'child-1', title: 'Meeting notes' },
      { id: 'child-2', title: 'Roadmap' },
    ]);

    render(<DocChildrenList isEditable />, { wrapper: AppWrapper });

    const list = await screen.findByRole('list', { name: 'Sub-docs' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps the focus on Retry while it retries, then moves it to the first sub-doc', async () => {
    let answerRetry: () => void = () => {};
    mockChildrenResponses(500);
    render(<DocChildrenList isEditable />, { wrapper: AppWrapper });

    const retry = await screen.findByRole('button', { name: 'Retry' });
    fetchMock.removeRoutes();
    fetchMock.route(
      CHILDREN_URL,
      () =>
        new Promise((resolve) => {
          answerRetry = () =>
            resolve({
              results: [{ id: 'child-1', title: 'Meeting notes' }],
              next: null,
              count: 1,
            });
        }),
    );
    retry.focus();
    fireEvent.click(retry);

    await waitFor(() => expect(childrenCalls()).toBe(2));
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    act(() => {
      answerRetry();
    });

    expect(await screen.findByText('Meeting notes')).toHaveFocus();
  });

  it('announces a retry that fails again', async () => {
    mockChildrenResponses(500, 500);
    render(<DocChildrenList isEditable />, { wrapper: AppWrapper });

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        'The sub-docs could not be loaded.',
        'polite',
      ),
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('refetches the sub-docs when the tree changes them, when the doc is not its root', async () => {
    mockChildrenResponses(
      [{ id: 'child-1', title: 'Meeting notes' }],
      [{ id: 'child-1', title: '📝 Meeting notes' }],
    );

    render(<Harness />, { wrapper: AppWrapper });
    act(() => {
      setHarnessTree(nestedTreeOf([{ id: 'child-1', title: 'Meeting notes' }]));
    });
    expect(await screen.findByText('Meeting notes')).toBeInTheDocument();

    act(() => {
      setHarnessTree(
        nestedTreeOf([{ id: 'child-1', title: '📝 Meeting notes' }]),
      );
    });

    expect(await screen.findByText('📝 Meeting notes')).toBeInTheDocument();
    expect(childrenCalls()).toBe(2);
  });
});
