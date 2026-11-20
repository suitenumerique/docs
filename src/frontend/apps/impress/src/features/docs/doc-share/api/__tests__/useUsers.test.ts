import { vi } from 'vitest';

import { fetchAPI } from '@/api';
import { User } from '@/features/auth';

import { getUsers } from '../useUsers';

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>();
  return {
    ...actual,
    fetchAPI: vi.fn(),
  };
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-id',
  is_first_connection: false,
  email: 'user@example.com',
  full_name: 'User Name',
  short_name: 'User',
  language: 'en-us',
  ...overrides,
});

describe('getUsers', () => {
  const mockedFetchAPI = vi.mocked(fetchAPI);

  beforeEach(() => {
    mockedFetchAPI.mockReset();
  });

  it('leaves users without an email address out of the search results', async () => {
    const userWithoutEmail = {
      ...makeUser({ id: 'no-email', full_name: '', short_name: '' }),
      email: null,
    };
    const userWithEmail = makeUser();

    mockedFetchAPI.mockResolvedValue({
      ok: true,
      json: async () => [userWithoutEmail, userWithEmail],
    } as Response);

    const users = await getUsers({ query: 'user', docId: 'doc-id' });

    expect(users).toEqual([userWithEmail]);
  });

  it('keeps users who have an email address', async () => {
    const userWithEmail = makeUser();

    mockedFetchAPI.mockResolvedValue({
      ok: true,
      json: async () => [userWithEmail],
    } as Response);

    const users = await getUsers({ query: 'user', docId: 'doc-id' });

    expect(users).toEqual([userWithEmail]);
  });
});
