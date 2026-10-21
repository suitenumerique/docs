import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

const DOC_ID = 'a1b2c3d4-e5f6-4789-a123-1234567890ab';

let mockDocQuery: { data?: { title?: string }; isLoading: boolean } = {
  data: undefined,
  isLoading: true,
};
let mockCurrentDoc: { deleted_at?: string | null } | undefined;

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/docs/doc-management/', async () => {
  const actual = await vi.importActual('@/docs/doc-management/');
  return {
    ...actual,
    useDoc: () => mockDocQuery,
    useDocStore: () => ({ currentDoc: mockCurrentDoc }),
  };
});

import { LinkSelected } from '../LinkSelected';

describe('LinkSelected', () => {
  const push = vi.fn();
  const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

  beforeEach(() => {
    push.mockClear();
    openSpy.mockClear();
    mockCurrentDoc = undefined;
    mockDocQuery = { data: undefined, isLoading: true };
    (useRouter as Mock).mockReturnValue({ push });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loader while the doc is loading', () => {
    mockDocQuery = { data: undefined, isLoading: true };

    render(<LinkSelected docId={DOC_ID} isEditable={true} />, {
      wrapper: AppWrapper,
    });

    expect(document.querySelector('.c__loader--small')).not.toBeNull();
  });

  it('renders the emoji and title once loaded', () => {
    mockDocQuery = { data: { title: '📄 My document' }, isLoading: false };

    render(<LinkSelected docId={DOC_ID} isEditable={true} />, {
      wrapper: AppWrapper,
    });

    expect(screen.getByText('📄')).toBeInTheDocument();
    expect(screen.getByText('My document')).toBeInTheDocument();
  });

  it('falls back to the href when the doc has no title', () => {
    mockDocQuery = { data: { title: '' }, isLoading: false };

    render(<LinkSelected docId={DOC_ID} isEditable={true} />, {
      wrapper: AppWrapper,
    });

    expect(screen.getByText(`Untitled document`)).toBeInTheDocument();
  });

  it('navigates on click with no modifier keys', () => {
    mockDocQuery = { data: { title: 'My document' }, isLoading: false };

    render(<LinkSelected docId={DOC_ID} isEditable={true} />, {
      wrapper: AppWrapper,
    });

    fireEvent.click(screen.getByRole('link'));

    expect(push).toHaveBeenCalledWith(`/docs/${DOC_ID}/`);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }])(
    'opens a new tab/window when %o click',
    (modifier) => {
      mockDocQuery = { data: { title: 'My document' }, isLoading: false };

      render(<LinkSelected docId={DOC_ID} isEditable={true} />, {
        wrapper: AppWrapper,
      });

      fireEvent.click(screen.getByRole('link'), modifier);

      expect(openSpy).toHaveBeenCalledWith(`/docs/${DOC_ID}/`, '_blank');
      expect(push).not.toHaveBeenCalled();
    },
  );

  it('opens a new tab on middle-mouse (auxclick) but not on other buttons', () => {
    mockDocQuery = { data: { title: 'My document' }, isLoading: false };

    render(<LinkSelected docId={DOC_ID} isEditable={true} />, {
      wrapper: AppWrapper,
    });

    const link = screen.getByRole('link');

    fireEvent(
      link,
      new MouseEvent('auxclick', {
        bubbles: true,
        button: 0,
        cancelable: true,
      }),
    );
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent(
      link,
      new MouseEvent('auxclick', {
        bubbles: true,
        button: 1,
        cancelable: true,
      }),
    );
    expect(openSpy).toHaveBeenCalledWith(`/docs/${DOC_ID}/`, '_blank');
  });

  it('navigates on Enter but ignores other keys', () => {
    mockDocQuery = { data: { title: 'My document' }, isLoading: false };

    render(<LinkSelected docId={DOC_ID} isEditable={true} />, {
      wrapper: AppWrapper,
    });

    const link = screen.getByRole('link');

    fireEvent.keyDown(link, { key: ' ' });
    expect(push).not.toHaveBeenCalled();

    fireEvent.keyDown(link, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith(`/docs/${DOC_ID}/`);
  });

  it('includes the block id anchor in the href when provided', () => {
    mockDocQuery = { data: { title: 'My document' }, isLoading: false };

    render(
      <LinkSelected docId={DOC_ID} blockId="block-1" isEditable={true} />,
      {
        wrapper: AppWrapper,
      },
    );

    fireEvent.click(screen.getByRole('link'));

    expect(push).toHaveBeenCalledWith(`/docs/${DOC_ID}/#block-1`);
  });

  it('disables interaction when the current doc is deleted', () => {
    mockDocQuery = { data: { title: 'My document' }, isLoading: false };
    mockCurrentDoc = { deleted_at: '2024-01-01T00:00:00Z' };

    render(<LinkSelected docId={DOC_ID} isEditable={true} />, {
      wrapper: AppWrapper,
    });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(link).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(link);
    expect(push).not.toHaveBeenCalled();

    fireEvent.keyDown(link, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();

    fireEvent(
      link,
      new MouseEvent('auxclick', {
        bubbles: true,
        button: 1,
        cancelable: true,
      }),
    );
    expect(openSpy).not.toHaveBeenCalled();
  });
});
