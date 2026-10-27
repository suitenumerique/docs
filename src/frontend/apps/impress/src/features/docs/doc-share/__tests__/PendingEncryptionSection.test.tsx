import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { DocumentEncryptionSettings } from '@/features/docs/doc-collaboration/hook/useDocumentEncryption';
import type { Access, Doc } from '@/features/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { PendingEncryptionSection } from '../components/PendingEncryptionSection';

const mocks = vi.hoisted(() => ({
  fetchRegisteredKeys: vi.fn(),
}));

vi.mock('@/features/docs/doc-collaboration/vault', () => ({
  useVaultClient: () => ({ client: {} }),
  fetchRegisteredKeys: mocks.fetchRegisteredKeys,
}));

vi.mock('../api/useAcceptEncryptionAccess', () => ({
  useAcceptPendingMembers: () => vi.fn(),
}));

const doc = { id: 'doc-1' } as Doc;

const pendingAccess = (sub: string, name: string) =>
  ({
    id: `access-${sub}`,
    is_pending_encryption: true,
    document: { id: doc.id },
    user: {
      suite_user_id: sub,
      full_name: name,
      email: `${sub}@example.com`,
    },
  }) as unknown as Access;

const accesses = [
  pendingAccess('ready', 'Ready Person'),
  pendingAccess('waiting', 'Waiting Person'),
];

const settings = {} as DocumentEncryptionSettings;

describe('PendingEncryptionSection', () => {
  beforeEach(() => {
    mocks.fetchRegisteredKeys.mockResolvedValue({
      publicKeys: { ready: new ArrayBuffer(8) },
      versions: { ready: 1 },
    });
  });

  test('offers Accept to a member manager for someone who enabled encryption', async () => {
    render(
      <PendingEncryptionSection
        doc={doc}
        accesses={accesses}
        documentEncryptionSettings={settings}
        canAccept
      />,
      { wrapper: AppWrapper },
    );

    expect(
      await screen.findByRole('button', { name: 'Accept' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Action needed')).toBeInTheDocument();
    expect(screen.queryByText('Encryption enabled')).not.toBeInTheDocument();
    expect(screen.getAllByText('Waiting for encryption')).toHaveLength(1);
  });

  test('shows the list read-only to someone who cannot manage members', async () => {
    render(
      <PendingEncryptionSection
        doc={doc}
        accesses={accesses}
        documentEncryptionSettings={settings}
        canAccept={false}
      />,
      { wrapper: AppWrapper },
    );

    expect(await screen.findByText('Encryption enabled')).toBeInTheDocument();
    expect(screen.getByText('Waiting for access')).toBeInTheDocument();
    expect(screen.queryByText('Action needed')).not.toBeInTheDocument();
    expect(screen.getByText('Ready Person')).toBeInTheDocument();
    expect(screen.getByText('Waiting Person')).toBeInTheDocument();
    expect(screen.getAllByText('Waiting for encryption')).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Accept' }),
    ).not.toBeInTheDocument();
  });

  test('tells a member manager that nobody is ready to accept yet', async () => {
    mocks.fetchRegisteredKeys.mockResolvedValue({
      publicKeys: {},
      versions: {},
    });

    render(
      <PendingEncryptionSection
        doc={doc}
        accesses={accesses}
        documentEncryptionSettings={settings}
        canAccept
      />,
      { wrapper: AppWrapper },
    );

    expect(await screen.findAllByText('Waiting for encryption')).toHaveLength(
      2,
    );
    expect(screen.getByText('Waiting for access')).toBeInTheDocument();
    expect(screen.queryByText('Action needed')).not.toBeInTheDocument();
  });
});
