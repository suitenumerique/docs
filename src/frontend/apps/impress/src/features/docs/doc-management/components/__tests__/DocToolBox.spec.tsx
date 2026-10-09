import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { Doc, LinkReach, Role } from '../../types';
import { DocToolBox } from '../DocToolBox';

vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
  }),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ authenticated: true }),
}));

const isFeatureFlagActivatedMock = vi.fn();
vi.mock('@/libs/Analytics', () => ({
  useAnalytics: () => ({
    isFeatureFlagActivated: isFeatureFlagActivatedMock,
    trackEvent: vi.fn(),
  }),
}));

const useConfigMock = vi.fn();
vi.mock('@/core/config/api', () => ({
  useConfig: () => useConfigMock(),
}));

const duplicateDocMock = vi.fn();
vi.mock('@/docs/doc-management/components/ConfirmationDuplicateModal', () => ({
  useDuplicatedDoc: () => ({
    mutate: duplicateDocMock,
    isPending: false,
  }),
  ConfirmationDuplicateModal: () => (
    <div data-testid="confirmation-duplicate-modal" />
  ),
}));

const createDoc = (overrides: Partial<Doc> = {}): Doc => ({
  id: 'doc-id',
  title: 'My document',
  created_at: '',
  creator: '',
  deleted_at: null,
  depth: 1,
  path: '0001',
  is_favorite: false,
  link_reach: LinkReach.RESTRICTED,
  computed_link_reach: LinkReach.RESTRICTED,
  ancestors_link_reach: LinkReach.RESTRICTED,
  nb_accesses_direct: 0,
  nb_accesses_ancestors: 0,
  numchild: 0,
  updated_at: '',
  user_role: Role.OWNER,
  abilities: {
    accesses_manage: false,
    accesses_view: false,
    ai_proxy: false,
    ai_transform: false,
    ai_translate: false,
    attachment_upload: false,
    children_create: false,
    children_list: false,
    collaboration_auth: false,
    comment: false,
    content_patch: false,
    content_retrieve: false,
    destroy: false,
    duplicate: true,
    favorite: false,
    formatted_content: false,
    invite_owner: false,
    leave: false,
    link_configuration: false,
    link_select_options: {},
    media_auth: false,
    move: false,
    partial_update: true,
    restore: false,
    retrieve: false,
    search: false,
    update: false,
    versions_list: false,
  },
  ...overrides,
});

const openDuplicateOption = async () => {
  const trigger = screen.getByRole('button', {
    name: /Open the document options/i,
  });
  await userEvent.click(trigger);

  const duplicateOption = await screen.findByRole('menuitem', {
    name: 'Duplicate',
  });
  await userEvent.click(duplicateOption);
};

describe('<DocToolBox /> - duplicate with children', () => {
  test('opens the confirmation modal when the posthog flag and the backend setting are both active and the doc has children', async () => {
    isFeatureFlagActivatedMock.mockReturnValue(true);
    useConfigMock.mockReturnValue({
      data: { DUPLICATE_CHILDREN_FEATURE_ENABLED: true },
    });
    const doc = createDoc({ numchild: 3 });

    render(<DocToolBox doc={doc} isCurrentDoc />, { wrapper: AppWrapper });

    await openDuplicateOption();

    await waitFor(() => {
      expect(
        screen.getByTestId('confirmation-duplicate-modal'),
      ).toBeInTheDocument();
    });
    expect(duplicateDocMock).not.toHaveBeenCalled();
  });

  test('duplicates directly when the posthog flag is inactive, even if the backend setting is active and the doc has children', async () => {
    isFeatureFlagActivatedMock.mockReturnValue(false);
    useConfigMock.mockReturnValue({
      data: { DUPLICATE_CHILDREN_FEATURE_ENABLED: true },
    });
    const doc = createDoc({ numchild: 3 });

    render(<DocToolBox doc={doc} isCurrentDoc />, { wrapper: AppWrapper });

    await openDuplicateOption();

    await waitFor(() => {
      expect(duplicateDocMock).toHaveBeenCalledWith({
        docId: doc.id,
        canSave: doc.abilities.partial_update,
      });
    });
    expect(
      screen.queryByTestId('confirmation-duplicate-modal'),
    ).not.toBeInTheDocument();
  });

  test('duplicates directly when the backend setting is inactive, even if the posthog flag is active and the doc has children', async () => {
    isFeatureFlagActivatedMock.mockReturnValue(true);
    useConfigMock.mockReturnValue({
      data: { DUPLICATE_CHILDREN_FEATURE_ENABLED: false },
    });
    const doc = createDoc({ numchild: 3 });

    render(<DocToolBox doc={doc} isCurrentDoc />, { wrapper: AppWrapper });

    await openDuplicateOption();

    await waitFor(() => {
      expect(duplicateDocMock).toHaveBeenCalledWith({
        docId: doc.id,
        canSave: doc.abilities.partial_update,
      });
    });
    expect(
      screen.queryByTestId('confirmation-duplicate-modal'),
    ).not.toBeInTheDocument();
  });

  test('duplicates directly when both flags are active but the doc has no children', async () => {
    isFeatureFlagActivatedMock.mockReturnValue(true);
    useConfigMock.mockReturnValue({
      data: { DUPLICATE_CHILDREN_FEATURE_ENABLED: true },
    });
    const doc = createDoc({ numchild: 0 });

    render(<DocToolBox doc={doc} isCurrentDoc />, { wrapper: AppWrapper });

    await openDuplicateOption();

    await waitFor(() => {
      expect(duplicateDocMock).toHaveBeenCalledWith({
        docId: doc.id,
        canSave: doc.abilities.partial_update,
      });
    });
    expect(
      screen.queryByTestId('confirmation-duplicate-modal'),
    ).not.toBeInTheDocument();
  });
});
