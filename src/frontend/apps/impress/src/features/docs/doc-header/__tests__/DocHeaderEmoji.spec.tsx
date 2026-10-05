import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

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
  }: {
    onEmojiSelect: (emoji: { native: string }) => void;
  }) => (
    <button type="button" onClick={() => onEmojiSelect({ native: '😀' })}>
      😀
    </button>
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
  });

  test('opens the picker without setting a default emoji', async () => {
    const user = userEvent.setup();
    render(<DocHeader doc={doc} />, { wrapper: AppWrapper });

    await user.click(screen.getByRole('button', { name: 'Add emoji' }));

    expect(screen.getByRole('button', { name: '😀' })).toBeVisible();
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
