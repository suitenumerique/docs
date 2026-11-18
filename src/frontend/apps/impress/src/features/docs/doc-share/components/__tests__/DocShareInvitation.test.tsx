import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Doc, Role } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { Invitation } from '../../types';
import { DocShareInvitationItem } from '../DocShareInvitation';

const doc = {
  id: 'doc-1',
  title: 'My doc',
  abilities: { accesses_manage: true },
} as Doc;

const makeInvitation = ({
  role = Role.OWNER,
  setRoleTo,
}: {
  role?: Role;
  setRoleTo: Role[];
}): Invitation => {
  const canManage = setRoleTo.length > 0;
  return {
    id: 'invitation-1',
    role,
    document: doc.id,
    created_at: '2026-11-09T00:00:00Z',
    is_expired: false,
    issuer: 'user-1',
    email: 'guest@example.com',
    abilities: {
      destroy: canManage,
      retrieve: true,
      partial_update: canManage,
      update: canManage,
      set_role_to: setRoleTo,
    },
  };
};

// What the backend returns to an administrator: every role but owner
const ADMINISTRATOR_ROLES = [
  Role.READER,
  'commenter' as Role,
  Role.EDITOR,
  Role.ADMIN,
];

describe('DocShareInvitationItem', () => {
  it('lets the role be changed when the invitation can be updated', () => {
    render(
      <DocShareInvitationItem
        doc={doc}
        invitation={makeInvitation({ setRoleTo: Object.values(Role) })}
      />,
      { wrapper: AppWrapper },
    );

    expect(
      screen.getByRole('button', { name: /Change role for guest@example.com/ }),
    ).toBeInTheDocument();
  });

  it('only shows the role when the invitation cannot be updated, even to a manager of the document', () => {
    render(
      <DocShareInvitationItem
        doc={doc}
        invitation={makeInvitation({ setRoleTo: [] })}
      />,
      { wrapper: AppWrapper },
    );

    expect(
      screen.queryByRole('button', { name: /Change role for/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Document role text')).toBeInTheDocument();
  });

  it('only enables the roles the backend allows', async () => {
    render(
      <DocShareInvitationItem
        doc={doc}
        invitation={makeInvitation({
          role: Role.EDITOR,
          setRoleTo: ADMINISTRATOR_ROLES,
        })}
      />,
      { wrapper: AppWrapper },
    );

    const trigger = screen.getByRole('button', {
      name: /Change role for guest@example.com/,
    });
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    const menu = screen.getByRole('menu');
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Owner' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Editor' }),
    ).not.toHaveAttribute('aria-disabled');
    // The restriction comes from the role of the user, not from a parent page
    expect(
      within(menu).queryByText(/inherited from a parent page/),
    ).not.toBeInTheDocument();
  });
});
