import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DocDefaultFilter } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { DocsGridColumnName } from '../DocsGridColumnName';

describe('DocsGridColumnName', () => {
  [
    DocDefaultFilter.ALL_DOCS,
    DocDefaultFilter.MY_DOCS,
    DocDefaultFilter.SHARED_WITH_ME,
    DocDefaultFilter.STARRED,
  ].forEach((target) => {
    it(`can sort the "${target}" list`, async () => {
      const setOrdering = vi.fn();

      render(
        <DocsGridColumnName
          target={target}
          ordering="-updated_at"
          setOrdering={setOrdering}
        />,
        { wrapper: AppWrapper },
      );

      await userEvent.click(
        screen.getByRole('button', { name: 'Sort documents by Name' }),
      );
      expect(setOrdering).toHaveBeenCalledTimes(1);

      // The updater toggles the ordering of the field already sorted
      const updater = setOrdering.mock.calls[0][0] as (prev: string) => string;
      expect(updater('-updated_at')).toBe('title');
      expect(updater('title')).toBe('-title');

      expect(
        screen.getByRole('button', {
          name: /^Sorted documents by Last modified/,
        }),
      ).toBeInTheDocument();
    });
  });

  it('cannot sort the trashbin', () => {
    render(
      <DocsGridColumnName
        target={DocDefaultFilter.TRASHBIN}
        ordering="-updated_at"
        setOrdering={vi.fn()}
      />,
      { wrapper: AppWrapper },
    );

    expect(screen.getByText('Days remaining')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
