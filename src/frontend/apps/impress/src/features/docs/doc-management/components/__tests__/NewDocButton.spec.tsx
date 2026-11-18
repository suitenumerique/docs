import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { useDocStore } from '../../stores/useDocStore';
import { Doc } from '../../types';
import { NewDocButton } from '../NewDocButton';

vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
  }),
}));

const useConfigMock = vi.fn();
vi.mock('@/core/config/api/useConfig', () => ({
  useConfig: () => useConfigMock(),
}));

vi.mock('../../hooks/useImport', () => ({
  useImport: () => ({
    getInputProps: () => ({}),
    open: vi.fn(),
    isPending: false,
    isEnabled: useConfigMock().data?.CONVERSION_UPLOAD_ENABLED ?? false,
  }),
}));

const setCurrentDoc = (childrenCreate: boolean) => {
  useDocStore.setState({
    currentDoc: {
      id: 'doc-id',
      abilities: { children_create: childrenCreate },
    } as unknown as Doc,
  });
};

const MENU_TRIGGER = { name: 'Open new document options' };

describe('<NewDocButton />', () => {
  beforeEach(() => {
    useDocStore.setState({ currentDoc: undefined });
    useConfigMock.mockReturnValue({
      data: { CONVERSION_UPLOAD_ENABLED: true },
    });
  });

  test('offers the sub-doc creation when the user can create children', async () => {
    // The sub-doc creation does not depend on the file conversion
    useConfigMock.mockReturnValue({
      data: { CONVERSION_UPLOAD_ENABLED: false },
    });
    setCurrentDoc(true);

    render(<NewDocButton />, { wrapper: AppWrapper });

    await userEvent.click(screen.getByRole('button', MENU_TRIGGER));

    expect(
      await screen.findByRole('menuitem', { name: 'New sub-doc' }),
    ).toBeInTheDocument();
  });

  test('hides the menu on a doc where the user cannot create children', () => {
    setCurrentDoc(false);

    render(<NewDocButton />, { wrapper: AppWrapper });

    expect(screen.getByTestId('new-doc-button')).toBeInTheDocument();
    expect(screen.queryByRole('button', MENU_TRIGGER)).not.toBeInTheDocument();
  });

  test('keeps the import menu outside of a doc', async () => {
    render(<NewDocButton />, { wrapper: AppWrapper });

    await userEvent.click(screen.getByRole('button', MENU_TRIGGER));

    expect(
      await screen.findByRole('menuitem', { name: 'Import a document' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'New sub-doc' }),
    ).not.toBeInTheDocument();
  });

  test('hides the menu outside of a doc when the import is disabled', () => {
    useConfigMock.mockReturnValue({
      data: { CONVERSION_UPLOAD_ENABLED: false },
    });

    render(<NewDocButton />, { wrapper: AppWrapper });

    expect(screen.getByTestId('new-doc-button')).toBeInTheDocument();
    expect(screen.queryByRole('button', MENU_TRIGGER)).not.toBeInTheDocument();
  });
});
