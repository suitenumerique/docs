import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Doc, LinkReach } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../DocsGridActions', () => ({
  DocsGridActions: ({ doc }: { doc: { title?: string } }) => (
    <button
      type="button"
      aria-label={`Open the document options: ${doc.title}`}
    >
      more
    </button>
  ),
}));

import { DocsGridItem } from '../DocsGridItem';

const doc = {
  id: 'doc-1',
  title: 'My document',
  updated_at: DateTime.now().minus({ days: 2 }).toISO(),
  is_favorite: false,
  nb_accesses_direct: 3,
  link_reach: LinkReach.RESTRICTED,
  depth: 1,
  numchild: 0,
  path: '0001',
} as Doc;

describe('DocsGridItem keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get('http://test.jest/api/v1.0/config/', {
      body: JSON.stringify({}),
    });
  });

  afterEach(() => {
    fetchMock.hardReset();
  });

  it('announces the title, date and participants on the document link', () => {
    render(<DocsGridItem doc={doc} />, { wrapper: AppWrapper });

    const link = screen.getByRole('link', {
      name: /My document, updated .+ ago, shared with 3 participant\(s\)/,
    });

    expect(link).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Open document/ }),
    ).not.toBeInTheDocument();
  });

  it('tabs from the document item to its actions, skipping the share count', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">before</button>
        <DocsGridItem doc={doc} />
        <button type="button">after</button>
      </>,
      { wrapper: AppWrapper },
    );

    const link = screen.getByRole('link', { name: /My document, updated/ });
    const options = screen.getByRole('button', {
      name: 'Open the document options: My document',
    });
    const share = screen.getByRole('button', {
      name: 'Open the sharing settings for the document',
    });

    expect(share).toHaveAttribute('tabindex', '-1');

    await user.tab();
    expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();

    await user.tab();
    expect(link).toHaveFocus();

    await user.tab();
    expect(options).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });
});
