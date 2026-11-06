import { render, screen } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { Doc } from '../../types';
import { DocMoveModal } from '../DocMoveModal';

vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
  }),
}));

const createDoc = (overrides: Partial<Doc>) =>
  ({
    title: '',
    created_at: '',
    updated_at: '',
    abilities: { move: true, move_to_another_tree: false },
    ...overrides,
  }) as Doc;

describe('<DocMoveModal />', () => {
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
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get('begin:http://test.jest/api/v1.0/documents/search/', {
      count: 2,
      next: null,
      previous: null,
      results: [sameTreeDoc, otherTreeDoc],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('only offers the targets of its tree without the right to leave it', async () => {
    const doc = createDoc({ id: 'moved', path: '00000010000001' });

    render(<DocMoveModal doc={doc} isOpen onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });

    expect(await screen.findByText('Doc of the same tree')).toBeInTheDocument();
    expect(screen.queryByText('Doc of another tree')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Only an owner can move this document out of its root document.',
      ),
    ).toBeInTheDocument();
  });

  test('offers the targets of every tree with the right to leave it', async () => {
    const doc = createDoc({
      id: 'moved',
      path: '00000010000001',
      abilities: { move: true, move_to_another_tree: true } as Doc['abilities'],
    });

    render(<DocMoveModal doc={doc} isOpen onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });

    expect(await screen.findByText('Doc of another tree')).toBeInTheDocument();
    expect(screen.getByText('Doc of the same tree')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Only an owner can move this document out of its root document.',
      ),
    ).not.toBeInTheDocument();
  });
});
