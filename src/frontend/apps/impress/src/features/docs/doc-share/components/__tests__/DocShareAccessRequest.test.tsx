import { VariantType } from '@gouvfr-lasuite/ui-components';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Command } from 'cmdk';
import fetchMock from 'fetch-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessRequest, Doc, Role } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { QuickSearchGroupAccessRequest } from '../DocShareAccessRequest';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}));

vi.mock('@gouvfr-lasuite/ui-components', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gouvfr-lasuite/ui-components')>();

  return {
    ...actual,
    useToastProvider: () => ({ toast: mocks.toast }),
  };
});

const DOC = {
  id: 'doc-id',
  abilities: { accesses_view: true, accesses_manage: true },
} as unknown as Doc;

const ACCESS_REQUEST: AccessRequest = {
  id: 'request-id',
  document: 'doc-id',
  user: {
    id: 'user-id',
    email: 'jane@example.com',
    full_name: 'Jane Doe',
    short_name: 'Jane',
    is_first_connection: false,
  },
  role: Role.READER,
  created_at: '2026-11-06T10:00:00Z',
  abilities: {
    destroy: true,
    update: true,
    partial_update: true,
    retrieve: true,
    accept: true,
    set_role_to: [Role.READER, Role.EDITOR, Role.ADMIN],
  },
};

const ACCEPT_URL =
  'http://test.jest/api/v1.0/documents/doc-id/ask-for-access/request-id/accept/';

const renderGroup = () =>
  render(
    <Command>
      <Command.List>
        <QuickSearchGroupAccessRequest doc={DOC} />
      </Command.List>
    </Command>,
    { wrapper: AppWrapper },
  );

describe('QuickSearchGroupAccessRequest', () => {
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

    mocks.toast.mockReset();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(
      'http://test.jest/api/v1.0/documents/doc-id/ask-for-access/?page=1',
      {
        body: {
          count: 1,
          next: null,
          previous: null,
          results: [ACCESS_REQUEST],
        },
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('says why approving is refused when the user already has the role', async () => {
    fetchMock.post(ACCEPT_URL, {
      status: 400,
      body: {
        detail:
          'This user already has this role or a higher one on this document.',
      },
    });

    renderGroup();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Approve' }),
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        'Jane Doe already has this role or a higher one.',
        VariantType.ERROR,
        { duration: 4000 },
      );
    });
  });

  it('shows a generic error when approving fails otherwise', async () => {
    fetchMock.post(ACCEPT_URL, { status: 500 });

    renderGroup();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Approve' }),
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        'Error while approving the request.',
        VariantType.ERROR,
        { duration: 4000 },
      );
    });
  });
});
