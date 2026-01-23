import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { LinkReach } from '../../doc-management';
import { DocEditor } from '../components/DocEditor';

vi.mock('@/stores', () => ({
  useResponsiveStore: () => ({ isDesktop: false }),
}));

vi.mock('@/features/skeletons', () => ({
  useSkeletonStore: () => ({
    setIsSkeletonVisible: vi.fn(),
  }),
}));

vi.mock('../../doc-management', async () => {
  const actual = await vi.importActual<any>('../../doc-management');
  return {
    ...actual,
    useIsCollaborativeEditable: () => ({ isEditable: true, isLoading: false }),
    useProviderStore: () => ({
      provider: {
        configuration: { name: 'test-doc-id' },
        document: {
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
  BlockNoteEditor: () => null,
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
});
