import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

const mockUpdateDocEmoji = vi.fn();

vi.mock('@/docs/doc-management', async () => {
  const actual = await vi.importActual('@/docs/doc-management');
  return {
    ...actual,
    useDocTitleUpdate: () => ({ updateDocEmoji: mockUpdateDocEmoji }),
  };
});

import { DocHeader } from '../components/DocHeader';

const doc = {
  id: 'doc-1',
  title: 'My document',
  is_favorite: false,
  nb_accesses_direct: 1,
  abilities: {
    versions_list: true,
    destroy: true,
    partial_update: true,
    duplicate: true,
    accesses_view: true,
  },
} as any;

describe('DocHeader - Add emoji (April Fools easter egg)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUpdateDocEmoji.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  [
    { emoji: '🐟', date: '2026-04-01' },
    { emoji: '📄', date: '2026-03-30' },
    { emoji: '📄', date: '2026-04-02' },
  ].forEach(({ emoji, date }) => {
    test(`uses ${emoji} emoji on ${date}`, () => {
      vi.setSystemTime(new Date(date));

      render(<DocHeader doc={doc} />, { wrapper: AppWrapper });

      fireEvent.click(screen.getByRole('button', { name: 'Add icon' }));

      expect(mockUpdateDocEmoji).toHaveBeenCalledWith(
        'doc-1',
        'My document',
        emoji,
      );
    });
  });
});
