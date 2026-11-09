import { describe, expect, it } from 'vitest';

import { Access, Role } from '@/docs/doc-management';

import {
  getMentionableUserName,
  getMentionableUsers,
} from '../useMentionableUsers';

const createAccess = (
  id: string,
  fullName: string,
  maxRole: string = Role.EDITOR,
  user: Partial<Access['user']> | null = {},
) =>
  ({
    id: `access-${id}`,
    role: maxRole,
    max_role: maxRole,
    user:
      user === null
        ? null
        : { id, full_name: fullName, short_name: fullName, ...user },
  }) as unknown as Access;

const accesses = [
  createAccess('1', 'Dupont Thomas', Role.OWNER),
  createAccess('2', 'Dupont Julie'),
  createAccess('3', 'Dupond Diallo', 'commenter'),
  createAccess('4', 'Sarah Reader', Role.READER),
  createAccess('5', '', Role.EDITOR, null),
];

describe('getMentionableUsers', () => {
  it('returns an empty list while the accesses are not loaded', () => {
    expect(getMentionableUsers(undefined, '')).toEqual([]);
  });

  it('keeps the users allowed to comment, without readers nor teams', () => {
    expect(getMentionableUsers(accesses, '').map(({ id }) => id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('lists a user once when it has several accesses on the ancestors', () => {
    const duplicated = [...accesses, createAccess('2', 'Dupont Julie')];

    expect(getMentionableUsers(duplicated, '').map(({ id }) => id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('filters the users on the name, ignoring the case', () => {
    expect(
      getMentionableUsers(accesses, ' dupont ').map(({ id }) => id),
    ).toEqual(['1', '2']);
    expect(getMentionableUsers(accesses, 'DIALLO').map(({ id }) => id)).toEqual(
      ['3'],
    );
    expect(getMentionableUsers(accesses, 'nobody')).toEqual([]);
  });

  it('filters the users on the email when it is known', () => {
    const withEmail = [
      createAccess('6', 'Jane', Role.EDITOR, { email: 'jane@example.com' }),
    ];

    expect(getMentionableUsers(withEmail, 'example.com')).toHaveLength(1);
  });
});

describe('getMentionableUserName', () => {
  it('falls back on the short name then the email', () => {
    expect(
      getMentionableUserName({
        id: '1',
        full_name: 'Full',
        short_name: 'Short',
      }),
    ).toBe('Full');
    expect(
      getMentionableUserName({ id: '1', full_name: '', short_name: 'Short' }),
    ).toBe('Short');
    expect(
      getMentionableUserName({ id: '1', full_name: '', email: 'a@b.fr' }),
    ).toBe('a@b.fr');
  });
});
