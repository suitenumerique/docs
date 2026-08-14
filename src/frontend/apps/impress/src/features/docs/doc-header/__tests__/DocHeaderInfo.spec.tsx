import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Doc, LinkReach, Role } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { DocHeaderInfo } from '../components/DocHeaderInfo';

vi.mock('@/core', async () => {
  const actual = await vi.importActual('@/core');

  return {
    ...actual,
    useConfig: () => ({ data: {} }),
  };
});

const updatedAt = '2026-08-14T14:23:00';
const doc = {
  id: 'doc-1',
  abilities: {
    partial_update: true,
  },
  ancestors_link_reach: LinkReach.RESTRICTED,
  computed_link_reach: LinkReach.RESTRICTED,
  deleted_at: null,
  link_reach: LinkReach.RESTRICTED,
  nb_accesses_ancestors: 0,
  nb_accesses_direct: 1,
  updated_at: updatedAt,
  user_role: Role.OWNER,
} as Doc;

describe('<DocHeaderInfo />', () => {
  beforeEach(() => {
    const now = DateTime.now().set({
      year: 2026,
      month: 8,
      day: 14,
      hour: 14,
      minute: 28,
      second: 0,
      millisecond: 0,
    });
    vi.spyOn(DateTime, 'now').mockReturnValue(now);
  });

  afterEach(async () => {
    await act(async () => {
      await i18next.changeLanguage('en');
    });
    vi.restoreAllMocks();
  });

  it('keeps the relative date and exposes the full date on focus', async () => {
    const user = userEvent.setup();

    render(<DocHeaderInfo doc={doc} />, { wrapper: AppWrapper });

    const relativeDate = screen.getByText('5 minutes ago');
    expect(relativeDate).toHaveTextContent('5 minutes ago');
    expect(relativeDate.tagName).toBe('TIME');
    expect(relativeDate).toHaveAttribute('datetime', updatedAt);
    expect(relativeDate).not.toHaveAttribute('role', 'button');
    expect(relativeDate).toHaveAccessibleName(
      '5 minutes ago. 08/14/2026, 02:23 PM',
    );

    await user.tab();

    expect(relativeDate).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '08/14/2026, 02:23 PM',
    );
  });

  it('uses the current locale for the relative and full dates', async () => {
    const user = userEvent.setup();

    await act(async () => {
      await i18next.changeLanguage('fr');
    });

    render(<DocHeaderInfo doc={doc} />, { wrapper: AppWrapper });

    const relativeDate = screen.getByText('il y a 5 minutes');
    await user.tab();

    expect(relativeDate).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '14/08/2026 14:23',
    );
  });

  it('exposes the full date on hover', async () => {
    const user = userEvent.setup();

    render(<DocHeaderInfo doc={doc} />, { wrapper: AppWrapper });

    const relativeDate = screen.getByText('5 minutes ago');
    fireEvent.pointerMove(relativeDate, { pointerType: 'mouse' });
    await user.hover(relativeDate);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '08/14/2026, 02:23 PM',
    );
  });
});
