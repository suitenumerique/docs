import { CunninghamProvider } from '@gouvfr-lasuite/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { PropsWithChildren, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useDocSearchFilterStore } from '@/docs/doc-search/stores/useDocSearchFilterStore';
import { useTreeContextOrNull } from '@/docs/doc-tree/utils';
import { AppWrapper } from '@/tests/utils';

import { Doc } from '../../types';
import { DocMoveModal } from '../DocMoveModal';

vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
  }),
}));

const SEARCH_URL = 'http://test.jest/api/v1.0/documents/search/';

const createDoc = (overrides: Partial<Doc>) =>
  ({
    title: '',
    created_at: '',
    updated_at: '',
    abilities: { move: true, move_to_another_tree: false },
    ...overrides,
  }) as Doc;

const rootDoc = createDoc({ id: 'root', title: 'Root', path: '0000001' });
const sameTreeDoc = createDoc({
  id: 'same-tree',
  title: 'Doc of the same tree',
  path: '00000010000002',
});
const otherTreeDoc = createDoc({
  id: 'other-tree',
  title: 'Doc of another tree',
  path: '0000002',
});
const restrictedDoc = createDoc({ id: 'moved', path: '00000010000001' });
const ownedDoc = createDoc({
  id: 'moved',
  path: '00000010000001',
  abilities: { move: true, move_to_another_tree: true } as Doc['abilities'],
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

// The documents grid has no tree provider.
const GridWrapper = ({ children }: PropsWithChildren) => (
  <CunninghamProvider theme="default">
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  </CunninghamProvider>
);

const searchUrls = () =>
  fetchMock.callHistory
    .calls()
    .filter((call) => call.url.startsWith(SEARCH_URL))
    .map((call) => new URL(call.url));

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
    useDocSearchFilterStore.setState({ filter: 'all' });
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`begin:${SEARCH_URL}`, {
      count: 2,
      next: null,
      previous: null,
      results: [sameTreeDoc, otherTreeDoc],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('searches the tree of the document without the right to leave it', async () => {
    render(<DocMoveModal doc={restrictedDoc} isOpen onClose={vi.fn()} />, {
      wrapper: DocPageWrapper,
    });

    expect(await screen.findByText('Doc of the same tree')).toBeInTheDocument();
    expect(screen.queryByText('Doc of another tree')).not.toBeInTheDocument();
    expect(searchUrls()).not.toHaveLength(0);
    for (const url of searchUrls()) {
      expect(url.searchParams.get('document')).toBe('root');
    }
    // The search modal keeps its own filter.
    expect(useDocSearchFilterStore.getState().filter).toBe('all');
  });

  test('keeps the documents of its tree out of a document page', async () => {
    render(<DocMoveModal doc={restrictedDoc} isOpen onClose={vi.fn()} />, {
      wrapper: GridWrapper,
    });

    expect(await screen.findByText('Doc of the same tree')).toBeInTheDocument();
    expect(screen.queryByText('Doc of another tree')).not.toBeInTheDocument();
    expect(searchUrls()).not.toHaveLength(0);
    for (const url of searchUrls()) {
      expect(url.searchParams.has('document')).toBe(false);
    }
  });

  test('searches every tree with the right to leave it', async () => {
    render(<DocMoveModal doc={ownedDoc} isOpen onClose={vi.fn()} />, {
      wrapper: DocPageWrapper,
    });

    expect(await screen.findByText('Doc of another tree')).toBeInTheDocument();
    expect(screen.getByText('Doc of the same tree')).toBeInTheDocument();
    expect(searchUrls()).not.toHaveLength(0);
    for (const url of searchUrls()) {
      expect(url.searchParams.has('document')).toBe(false);
    }
  });

  test('ignores the filter of the search modal', async () => {
    useDocSearchFilterStore.setState({ filter: 'current' });

    render(<DocMoveModal doc={ownedDoc} isOpen onClose={vi.fn()} />, {
      wrapper: DocPageWrapper,
    });

    expect(await screen.findByText('Doc of another tree')).toBeInTheDocument();
    expect(searchUrls()).not.toHaveLength(0);
    for (const url of searchUrls()) {
      expect(url.searchParams.has('document')).toBe(false);
    }
    expect(useDocSearchFilterStore.getState().filter).toBe('current');
  });
});
