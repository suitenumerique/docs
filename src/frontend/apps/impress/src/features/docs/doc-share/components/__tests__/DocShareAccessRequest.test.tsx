import { VariantType } from '@gouvfr-lasuite/ui-components';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Command } from 'cmdk';
import fetchMock from 'fetch-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessRequest, Doc, Role } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import {
  ButtonAccessRequest,
  QuickSearchGroupAccessRequest,
} from '../DocShareAccessRequest';

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

vi.mock('@/features/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/auth')>();

  return {
    ...actual,
    useAuth: () => ({ authenticated: true }),
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

const LIST_URL =
  'http://test.jest/api/v1.0/documents/doc-id/ask-for-access/?page=1';
const ACCEPT_URL =
  'http://test.jest/api/v1.0/documents/doc-id/ask-for-access/request-id/accept/';
const DELETE_URL =
  'http://test.jest/api/v1.0/documents/doc-id/ask-for-access/request-id/';

const mockList = (results: AccessRequest[]) => {
  fetchMock.removeRoute('list');
  fetchMock.get(
    LIST_URL,
    { body: { count: results.length, next: null, previous: null, results } },
    { name: 'list' },
  );
};

const renderGroup = (doc: Doc = DOC) =>
  render(
    <Command>
      <Command.List>
        <QuickSearchGroupAccessRequest doc={doc} />
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
    mockList([ACCESS_REQUEST]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an error when approving fails', async () => {
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
        'Error while approving the request.',
        VariantType.ERROR,
        { duration: 4000 },
      );
    });
  });

  it('approves the request with its role', async () => {
    fetchMock.post(ACCEPT_URL, { status: 204 });

    renderGroup();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Approve' }),
    );

    await waitFor(() => {
      expect(fetchMock.callHistory.lastCall(ACCEPT_URL)?.options.body).toBe(
        JSON.stringify({ role: Role.READER }),
      );
    });
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('hides the approve button when the request cannot be accepted', async () => {
    mockList([
      {
        ...ACCESS_REQUEST,
        abilities: { ...ACCESS_REQUEST.abilities, accept: false },
      },
    ]);

    renderGroup();

    expect(
      await screen.findByRole('button', { name: 'Remove the access request' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
  });

  it('removes the request', async () => {
    fetchMock.delete(DELETE_URL, { status: 204 });

    renderGroup();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove the access request' }),
    );

    await waitFor(() => {
      expect(fetchMock.callHistory.called(DELETE_URL)).toBe(true);
    });
  });

  it('hides the remove button without the right to manage accesses', async () => {
    renderGroup({
      ...DOC,
      abilities: { ...DOC.abilities, accesses_manage: false },
    });

    expect(
      await screen.findByRole('button', { name: 'Approve' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove the access request' }),
    ).not.toBeInTheDocument();
  });
});

describe('ButtonAccessRequest', () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    mockList([]);
  });

  it('requests the admin role', async () => {
    const CREATE_URL =
      'http://test.jest/api/v1.0/documents/doc-id/ask-for-access/';
    fetchMock.post(CREATE_URL, { status: 201 });

    render(<ButtonAccessRequest docId="doc-id" />, { wrapper: AppWrapper });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Request access' }),
    );

    await waitFor(() => {
      expect(fetchMock.callHistory.lastCall(CREATE_URL)?.options.body).toBe(
        JSON.stringify({ role: Role.ADMIN }),
      );
    });
  });
});
