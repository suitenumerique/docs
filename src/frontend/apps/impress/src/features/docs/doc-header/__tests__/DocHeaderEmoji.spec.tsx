import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { EmojiPicker } from '@/components/Emoji/EmojiPicker';
import { AppWrapper } from '@/tests/utils';

const mockUpdateDocEmoji = vi.fn();

vi.mock('@/docs/doc-management', async () => {
  const actual = await vi.importActual('@/docs/doc-management');
  return {
    ...actual,
    useDocTitleUpdate: () => ({
      updateDocEmoji: mockUpdateDocEmoji,
      updateDocTitle: (_doc: unknown, title: string) => title,
    }),
  };
});

vi.mock('@/components/Emoji/EmojiPicker', () => ({
  EmojiPicker: ({
    onEmojiSelect,
    onClickOutside,
  }: ComponentProps<typeof EmojiPicker>) => (
    <div role="dialog" aria-label="Emoji picker">
      <button type="button" onClick={() => onEmojiSelect({ native: '😀' })}>
        😀
      </button>
      <button type="button" onClick={onClickOutside}>
        Click outside
      </button>
    </div>
  ),
}));

import { DocHeader } from '../components/DocHeader';

const doc = {
  id: 'doc-1',
  title: 'My document',
  abilities: { partial_update: true },
} as any;

describe('DocHeader - Add emoji', () => {
  beforeEach(() => {
    mockUpdateDocEmoji.mockClear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-08'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('opens the picker without setting a default emoji', async () => {
    const user = userEvent.setup();
    render(<DocHeader doc={doc} />, { wrapper: AppWrapper });

    await user.click(screen.getByRole('button', { name: 'Add emoji' }));

    expect(screen.getByRole('button', { name: '😀' })).toBeVisible();
    expect(mockUpdateDocEmoji).not.toHaveBeenCalled();
  });

  test('closes the picker on click outside without setting an emoji', async () => {
    const user = userEvent.setup();
    render(<DocHeader doc={doc} />, { wrapper: AppWrapper });

    await user.click(screen.getByRole('button', { name: 'Add emoji' }));
    await user.click(screen.getByRole('button', { name: 'Click outside' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockUpdateDocEmoji).not.toHaveBeenCalled();
  });

  test('sets the chosen emoji, keeping a title edited just before', async () => {
    const user = userEvent.setup();
    render(<DocHeader doc={{ ...doc, title: '' }} />, { wrapper: AppWrapper });

    const titleInput = screen.getByRole('textbox', { name: 'Document title' });
    await user.click(titleInput);
    titleInput.textContent = 'My new document';
    await user.click(screen.getByRole('button', { name: 'Add emoji' }));
    await user.click(screen.getByRole('button', { name: '😀' }));

    expect(mockUpdateDocEmoji).toHaveBeenCalledWith(
      'doc-1',
      'My new document',
      '😀',
    );
  });
});

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
    { emoji: '😀', date: '2026-03-30' },
    { emoji: '😀', date: '2026-04-02' },
  ].forEach(({ emoji, date }) => {
    test(`uses ${emoji} emoji on ${date}`, () => {
      vi.setSystemTime(new Date(date));

      render(<DocHeader doc={doc} />, { wrapper: AppWrapper });

      fireEvent.click(screen.getByRole('button', { name: 'Add emoji' }));
      fireEvent.click(screen.getByRole('button', { name: '😀' }));

      expect(mockUpdateDocEmoji).toHaveBeenCalledWith(
        'doc-1',
        'My document',
        emoji,
      );
    });
  });
});
