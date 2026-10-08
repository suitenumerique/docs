import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAllDocChildren } from '@/docs/doc-tree/api/useDocChildren';
import { AppWrapper } from '@/tests/utils';

import { DocChildrenList } from '../DocChildrenBlock';

vi.mock('@/docs/doc-management', async () => {
  const actual = await vi.importActual('@/docs/doc-management');
  return {
    ...actual,
    useDocStore: () => ({ currentDoc: { id: 'parent' } }),
  };
});

vi.mock('@/docs/doc-tree/api/useDocChildren', async () => {
  const actual = await vi.importActual('@/docs/doc-tree/api/useDocChildren');
  return { ...actual, getAllDocChildren: vi.fn() };
});

vi.mock('../../custom-inline-content/Interlinking/LinkSelected', () => ({
  LinkSelected: ({ doc }: { doc: { title: string } }) => (
    <span>{doc.title}</span>
  ),
}));

describe('DocChildrenList', () => {
  beforeEach(() => {
    vi.mocked(getAllDocChildren).mockReset();
  });

  it('says so when the sub-docs cannot be loaded, and retries on demand', async () => {
    vi.mocked(getAllDocChildren)
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce([
        { id: 'child-1', title: 'Meeting notes' },
      ] as Awaited<ReturnType<typeof getAllDocChildren>>);

    render(<DocChildrenList isEditable />, { wrapper: AppWrapper });

    expect(
      await screen.findByText('The sub-docs could not be loaded.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Meeting notes')).toBeInTheDocument();
    expect(getAllDocChildren).toHaveBeenCalledTimes(2);
  });
});
