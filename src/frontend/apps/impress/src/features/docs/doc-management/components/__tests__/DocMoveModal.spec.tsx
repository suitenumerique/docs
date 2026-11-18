import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { PropsWithChildren, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useDocSearchFilterStore } from '@/docs/doc-search/stores/useDocSearchFilterStore';
import { useTreeContextOrNull } from '@/docs/doc-tree/utils';
import { AppWrapper } from '@/tests/utils';

import { Doc, Role } from '../../types';
import { DocMoveModal } from '../DocMoveModal';

vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
  }),
}));

vi.mock('@/features/auth', async () => ({
  ...(await vi.importActual('@/features/auth')),
  useAuth: () => ({ authenticated: true }),
}));

const API_URL = 'http://test.jest/api/v1.0';
const SEARCH_URL = `${API_URL}/documents/search/`;
const TREE_URL = `${API_URL}/documents/moved/tree/`;

const createDoc = (overrides: Partial<Doc>) =>
  ({
    title: '',
    created_at: '',
    updated_at: '',
    nb_accesses_direct: 1,
    abilities: { move: true, move_to_another_tree: false },
    ...overrides,
  }) as Doc;

const rootDoc = createDoc({ id: 'root', title: 'Root' });
// May only move in its tree.
const movedDoc = createDoc({ id: 'moved' });
const ownedDoc = createDoc({
  id: 'moved',
  abilities: { move: true, move_to_another_tree: true } as Doc['abilities'],
});
const allowedTarget = createDoc({ id: 'allowed', title: 'Allowed target' });
const forbiddenTarget = createDoc({
  id: 'forbidden',
  title: 'Forbidden target',
  abilities: { move: false } as Doc['abilities'],
});

// The tree of a document page, opened on `rootDoc`.
const TreeRoot = ({ children }: PropsWithChildren) => {
  const treeContext = useTreeContextOrNull<Doc>();

  useEffect(() => {
    treeContext?.setRoot(rootDoc);
  }, [treeContext]);

  return treeContext?.root ? children : null;
};

const DocPageWrapper = ({ children }: PropsWithChildren) => (
  <AppWrapper>
    <TreeRoot>{children}</TreeRoot>
  </AppWrapper>
);

const searchUrls = () =>
  fetchMock.callHistory
    .calls()
    .filter((call) => call.url.startsWith(SEARCH_URL))
    .map((call) => new URL(call.url));

const expectSearchesIn = (documentId: string | null) => {
  expect(searchUrls()).not.toHaveLength(0);
  for (const url of searchUrls()) {
    expect(url.searchParams.get('document')).toBe(documentId);
  }
};

describe('<DocMoveModal />', () => {
  beforeEach(() => {
    // cmdk relies on browser APIs jsdom doesn't implement.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          // noop
        }
        unobserve() {
          // noop
        }
        disconnect() {
          // noop
        }
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
    // The toasts animate, jsdom doesn't implement it.
    Element.prototype.animate = vi.fn();
    useDocSearchFilterStore.setState({ filter: 'all' });
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`begin:${SEARCH_URL}`, {
      count: 2,
      next: null,
      previous: null,
      results: [allowedTarget, forbiddenTarget],
    });
    fetchMock.get(TREE_URL, rootDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('searches every document with the right to leave the tree', async () => {
    // The filter of the search modal doesn't apply.
    useDocSearchFilterStore.setState({ filter: 'current' });

    render(<DocMoveModal doc={ownedDoc} isOpen onClose={vi.fn()} />, {
      wrapper: DocPageWrapper,
    });

    expect(await screen.findByText('Allowed target')).toBeInTheDocument();
    expectSearchesIn(null);
    expect(fetchMock.callHistory.called(TREE_URL)).toBe(false);
    expect(useDocSearchFilterStore.getState().filter).toBe('current');
  });

  test('searches the tree of the document page without the right to leave it', async () => {
    render(<DocMoveModal doc={movedDoc} isOpen onClose={vi.fn()} />, {
      wrapper: DocPageWrapper,
    });

    expect(await screen.findByText('Allowed target')).toBeInTheDocument();
    expectSearchesIn('root');
    expect(fetchMock.callHistory.called(TREE_URL)).toBe(false);
  });

  test('fetches the tree of the document out of a document page', async () => {
    render(<DocMoveModal doc={movedDoc} isOpen onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });

    expect(await screen.findByText('Allowed target')).toBeInTheDocument();
    expect(fetchMock.callHistory.called(TREE_URL)).toBe(true);
    expectSearchesIn('root');
  });

  test('requests the administrator role on a target the user cannot move into', async () => {
    fetchMock.get(`begin:${API_URL}/documents/forbidden/ask-for-access/`, {
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    fetchMock.post(`${API_URL}/documents/forbidden/ask-for-access/`, 201);

    render(<DocMoveModal doc={movedDoc} isOpen onClose={vi.fn()} />, {
      wrapper: DocPageWrapper,
    });

    await userEvent.click(await screen.findByText('Forbidden target'));
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Move the document to the selected location',
      }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Request access' }),
    );

    const request = fetchMock.callHistory.lastCall(
      `${API_URL}/documents/forbidden/ask-for-access/`,
      { method: 'POST' },
    );
    expect(JSON.parse(request?.options.body as string)).toEqual({
      role: Role.ADMIN,
    });
    expect(
      fetchMock.callHistory.called(`begin:${API_URL}/documents/moved/move/`),
    ).toBe(false);
  });
});
