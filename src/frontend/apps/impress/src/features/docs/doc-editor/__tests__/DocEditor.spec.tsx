import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { LinkReach } from '../../doc-management';
import { DocEditor } from '../components/DocEditor';

// In node, `@sentry/nextjs` loads its server build, whose `ErrorBoundary`
// catches nothing: use the one its browser build re-exports.
vi.mock('@sentry/nextjs', async () => {
  const actual = await vi.importActual<any>('@sentry/nextjs');
  const { ErrorBoundary } = await vi.importActual<any>('@sentry/react');
  return { ...actual, ErrorBoundary };
});

// The error page links to the home page.
vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({ push: vi.fn() }),
}));

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
        roomname: 'test-doc-id',
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
  DocHeader: () => <div>Doc header</div>,
}));

const BlockNoteEditorMock = vi.fn((): null => null);
vi.mock('../components/BlockNoteEditor', () => ({
  BlockNoteEditor: () => BlockNoteEditorMock(),
  BlockNoteReader: () => null,
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

  describe('when the editor fails to render', () => {
    // The id of the mocked provider's room, so that the editor is rendered
    // rather than the skeleton.
    const getBrokenDoc = (canSeeVersions: boolean) =>
      ({
        id: 'test-doc-id',
        computed_link_reach: LinkReach.RESTRICTED,
        deleted_at: null,
        abilities: {
          partial_update: true,
          versions_list: canSeeVersions,
        },
      }) as any;

    beforeEach(() => {
      // Not `mockImplementationOnce`: React renders a component that threw a
      // second time before handing the error to the boundary.
      BlockNoteEditorMock.mockImplementation(() => {
        throw new Error('The editor failed to render');
      });
    });

    afterEach(() => {
      BlockNoteEditorMock.mockImplementation(() => null);
    });

    test('it shows the error in place of the editor and keeps the header', () => {
      render(<DocEditor doc={getBrokenDoc(true)} />, {
        wrapper: AppWrapper,
      });

      expect(screen.getByText('Doc header')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'An unexpected error occurred.' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'An unexpected error occurred. Go grab a coffee or try to refresh the page.',
        ),
      ).toBeInTheDocument();
    });

    test('it tells a user who cannot see the versions to contact the owner', () => {
      render(<DocEditor doc={getBrokenDoc(false)} />, {
        wrapper: AppWrapper,
      });

      expect(screen.getByText('Doc header')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Please contact the document owner to restore a previous version.',
        ),
      ).toBeInTheDocument();
    });
  });
});
