import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { LinkReach } from '../../doc-management';
import { DocCoreEditor, DocEditor } from '../components/DocEditor';

const mockProvider = vi.hoisted(() => ({ roomname: 'test-doc-id' }));

vi.mock('@/stores', () => ({
  useResponsiveStore: () => ({ isDesktop: false }),
}));

vi.mock('@/features/skeletons', async () => {
  const actual = await vi.importActual<any>('../../../skeletons');
  return {
    ...actual,
    useSkeletonStore: () => ({
      setIsSkeletonVisible: vi.fn(),
    }),
  };
});

vi.mock('../../doc-management', async () => {
  const actual = await vi.importActual<any>('../../doc-management');
  return {
    ...actual,
    useProviderStore: () => ({
      provider: {
        roomname: mockProvider.roomname,
        doc: {
          getXmlFragment: () => null,
        },
      },
      isReady: true,
    }),
    getDocLinkReach: (doc: any) => doc.computed_link_reach,
  };
});

vi.mock('../../doc-table-content', () => ({
  TableContent: () => null,
}));

vi.mock('../../doc-header', () => ({
  DocHeader: () => null,
}));

vi.mock('../components/BlockNoteEditor', () => ({
  BlockNoteEditor: () => <div data-testid="block-note-editor" />,
  BlockNoteReader: () => <div data-testid="block-note-reader" />,
}));

vi.mock('../../../auth', async () => {
  const actual = await vi.importActual<any>('../../../auth');
  return {
    ...actual,
    useAuth: () => ({ authenticated: true }),
  };
});

const TrackEventMock = vi.fn();
vi.mock('../../../../libs', async () => {
  const actual = await vi.importActual<any>('../../../../libs');
  return {
    ...actual,
    useAnalytics: () => ({
      trackEvent: TrackEventMock,
    }),
  };
});

describe('DocEditor', () => {
  test('it checks that trackevent is called with correct parameters', () => {
    const doc = {
      id: 'test-doc-id-1',
      computed_link_reach: LinkReach.PUBLIC,
      deleted_at: null,
      abilities: {
        partial_update: true,
      },
    } as any;

    const { rerender } = render(<DocEditor doc={doc} />, {
      wrapper: AppWrapper,
    });

    expect(TrackEventMock).toHaveBeenCalledWith({
      eventName: 'doc',
      isPublic: true,
      authenticated: true,
    });

    // Rerender with same doc to check that event is not tracked again
    rerender(
      <DocEditor doc={{ ...doc, computed_link_reach: LinkReach.RESTRICTED }} />,
    );

    expect(TrackEventMock).toHaveBeenNthCalledWith(1, {
      eventName: 'doc',
      isPublic: true,
      authenticated: true,
    });

    // Rerender with different doc to check that event is tracked again
    rerender(
      <DocEditor
        doc={{
          ...doc,
          id: 'test-doc-id-2',
          computed_link_reach: LinkReach.RESTRICTED,
        }}
      />,
    );

    expect(TrackEventMock).toHaveBeenNthCalledWith(2, {
      eventName: 'doc',
      isPublic: false,
      authenticated: true,
    });
  });
});

describe('DocCoreEditor', () => {
  const skeletonSelector = '.--docs--doc-editor-content-skeleton';

  test.each([
    [false, 'block-note-editor'],
    [true, 'block-note-reader'],
  ])(
    'it swaps the skeleton for the editor as soon as the provider is ready (readOnly: %s)',
    (readOnly, editorTestId) => {
      const doc = { id: 'test-doc-id' } as any;
      mockProvider.roomname = 'previous-doc-id';

      const { container, rerender } = render(
        <DocCoreEditor doc={doc} readOnly={readOnly} />,
        { wrapper: AppWrapper },
      );

      expect(container.querySelector(skeletonSelector)).toBeInTheDocument();
      expect(screen.queryByTestId(editorTestId)).not.toBeInTheDocument();

      // The editor mounts in the very render the provider gets ready: the
      // skeleton must not fade out before, it would leave the doc empty.
      mockProvider.roomname = 'test-doc-id';
      rerender(<DocCoreEditor doc={doc} readOnly={readOnly} />);

      expect(screen.getByTestId(editorTestId)).toBeInTheDocument();
      expect(container.querySelector(skeletonSelector)).not.toBeInTheDocument();
    },
  );
});
