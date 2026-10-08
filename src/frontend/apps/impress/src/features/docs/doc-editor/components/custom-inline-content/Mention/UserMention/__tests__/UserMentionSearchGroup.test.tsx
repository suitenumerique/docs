import { fireEvent, render, screen } from '@testing-library/react';
import { Command } from 'cmdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { UserMentionSearchGroup } from '../UserMentionSearchGroup';

const USERS = [
  { id: '1', full_name: 'Dupont Thomas', short_name: 'Thomas' },
  { id: '2', full_name: 'Dupont Julie', short_name: 'Julie' },
];

const renderGroup = (users = USERS, onSelect = vi.fn()) => {
  render(
    <Command>
      <Command.List>
        <UserMentionSearchGroup users={users} onSelect={onSelect} />
      </Command.List>
    </Command>,
    { wrapper: AppWrapper },
  );

  return { onSelect };
};

describe('UserMentionSearchGroup', () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the users under a heading', () => {
    renderGroup();

    expect(
      screen.getByRole('heading', { name: 'Mention a person' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dupont Thomas')).toBeInTheDocument();
    expect(screen.getByText('Dupont Julie')).toBeInTheDocument();
  });

  it('shows the initials of the users in an avatar', () => {
    renderGroup();

    expect(screen.getAllByText('DT')).toHaveLength(1);
    expect(screen.getAllByText('DJ')).toHaveLength(1);
  });

  it('renders nothing when there is no user', () => {
    renderGroup([]);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('gives the picked user to the callback', () => {
    const { onSelect } = renderGroup();

    fireEvent.click(screen.getByText('Dupont Julie'));

    expect(onSelect).toHaveBeenCalledWith(USERS[1]);
  });
});
