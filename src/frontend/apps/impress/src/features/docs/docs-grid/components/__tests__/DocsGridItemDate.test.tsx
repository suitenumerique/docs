import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import i18next from 'i18next';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Doc } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { DocsGridItemDate } from '../DocsGridItem';

describe('DocsGridItemDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  [
    {
      updated_at: DateTime.now().minus({ seconds: 1 }).toISO(),
      rendered: 'just now',
    },
    {
      updated_at: DateTime.now().minus({ minutes: 1 }).toISO(),
      rendered: '1 minute ago',
    },
    {
      updated_at: DateTime.now().minus({ days: 1 }).toISO(),
      rendered: '1 day ago',
    },
    {
      updated_at: DateTime.now().minus({ days: 5 }).toISO(),
      rendered: '5 days ago',
    },
    {
      updated_at: DateTime.now().minus({ days: 35 }).toISO(),
      rendered: '1 month ago',
    },
  ].forEach(({ updated_at, rendered }) => {
    it(`should render "${rendered}" from the updated_at field`, () => {
      render(
        <DocsGridItemDate
          doc={
            {
              updated_at,
            } as Doc
          }
          isInTrashbin={false}
        />,
        { wrapper: AppWrapper },
      );

      expect(screen.getByText(rendered)).toBeInTheDocument();
    });
  });

  it(`should render rendered the updated_at field in the correct language`, async () => {
    await act(async () => {
      await i18next.changeLanguage('fr');
    });

    render(
      <DocsGridItemDate
        doc={
          {
            updated_at: DateTime.now().minus({ days: 5 }).toISO(),
          } as Doc
        }
        isInTrashbin={false}
      />,
      { wrapper: AppWrapper },
    );

    expect(screen.getByText('il y a 5 jours')).toBeInTheDocument();

    await act(async () => {
      await i18next.changeLanguage('en');
    });
  });

  it('should expose the full updated_at date on hover', async () => {
    const user = userEvent.setup();
    const updatedAt = DateTime.now().minus({ minutes: 1 });

    render(
      <DocsGridItemDate
        doc={{ updated_at: updatedAt.toISO() } as Doc}
        isInTrashbin={false}
      />,
      { wrapper: AppWrapper },
    );

    const relativeDate = screen.getByText('1 minute ago');
    fireEvent.pointerMove(relativeDate, { pointerType: 'mouse' });
    await user.hover(relativeDate);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      updatedAt.setLocale('en').toLocaleString({
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  });

  [
    {
      deleted_at: DateTime.now().toISO(),
      rendered: '30 days',
      trashbin_cutoff_days: 30,
      updated_at: DateTime.now().toISO(),
    },
    {
      deleted_at: DateTime.now().toISO(),
      rendered: '1 day',
      trashbin_cutoff_days: 1,
      updated_at: DateTime.now().toISO(),
    },
    {
      deleted_at: DateTime.now().minus({ minutes: 1 }).toISO(),
      rendered: '1 minute ago',
      trashbin_cutoff_days: 0,
      updated_at: DateTime.now().minus({ minutes: 1 }).toISO(),
    },
  ].forEach(({ deleted_at, rendered, trashbin_cutoff_days, updated_at }) => {
    it(`should render "${rendered}" when we are in the trashbin`, async () => {
      fetchMock.get('http://test.jest/api/v1.0/config/', {
        body: JSON.stringify({
          TRASHBIN_CUTOFF_DAYS: trashbin_cutoff_days,
        }),
      });

      render(
        <DocsGridItemDate
          doc={
            {
              deleted_at,
              updated_at,
            } as Doc
          }
          isInTrashbin={true}
        />,
        { wrapper: AppWrapper },
      );

      await waitFor(
        () => {
          expect(screen.getByText(rendered)).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });
});
