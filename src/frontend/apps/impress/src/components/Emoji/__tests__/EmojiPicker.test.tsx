import { announce } from '@react-aria/live-announcer';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { EmojiPicker } from '../EmojiPicker';

vi.mock('@react-aria/live-announcer', () => ({ announce: vi.fn() }));

describe('EmojiPicker keys', () => {
  const onDocumentKeyDown = vi.fn();

  // Frimousse measures its list, jsdom has no ResizeObserver.
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          // noop
        }
        unobserve() {
          // noop
        }
        disconnect() {
          // noop
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('keydown', onDocumentKeyDown);
    onDocumentKeyDown.mockReset();
  });

  // Frimousse only listens on `document`, like the doc tree, whose items stop
  // the keys of what is portalled out of them.
  const renderInStoppingAncestor = async () => {
    document.addEventListener('keydown', onDocumentKeyDown);
    const onEmojiSelect = vi.fn();

    render(
      <div onKeyDown={(event) => event.stopPropagation()}>
        {createPortal(
          <EmojiPicker
            onClickOutside={vi.fn()}
            onEmojiSelect={onEmojiSelect}
          />,
          document.body,
        )}
      </div>,
      { wrapper: AppWrapper },
    );
    // Frimousse loads its data once mounted, the test must not end before.
    await screen.findAllByRole('gridcell');

    return {
      search: screen.getByRole('searchbox', { name: 'Search' }),
      onEmojiSelect,
    };
  };

  it('hands the keys over to the document despite an ancestor stopping them', async () => {
    const { search } = await renderInStoppingAncestor();

    fireEvent.keyDown(search, { key: 'ArrowDown' });

    expect(onDocumentKeyDown).toHaveBeenCalledTimes(1);
    expect(onDocumentKeyDown.mock.calls[0][0]).toMatchObject({
      key: 'ArrowDown',
    });
  });

  it('keeps the default action prevented by the document', async () => {
    const { search } = await renderInStoppingAncestor();
    onDocumentKeyDown.mockImplementation((event: KeyboardEvent) =>
      event.preventDefault(),
    );

    // fireEvent returns false when the default action was prevented
    expect(fireEvent.keyDown(search, { key: 'Enter' })).toBe(false);
  });

  it('selects the active emoji with ArrowDown then Enter', async () => {
    const { search, onEmojiSelect } = await renderInStoppingAncestor();
    // Frimousse only handles the keys while the picker holds the focus
    act(() => search.focus());
    const [first] = screen.getAllByRole('gridcell');

    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onEmojiSelect).toHaveBeenCalledWith(first.textContent);
  });

  it.each([
    ['isComposing', { isComposing: true }],
    ['keyCode 229', { keyCode: 229 }],
  ])(
    'leaves the Enter of an IME composition (%s) to the IME',
    async (_, init) => {
      const { search, onEmojiSelect } = await renderInStoppingAncestor();
      act(() => search.focus());

      fireEvent.keyDown(search, { key: 'ArrowDown' });
      onDocumentKeyDown.mockClear();
      // fireEvent returns true when the default action was not prevented
      expect(fireEvent.keyDown(search, { key: 'Enter', ...init })).toBe(true);

      expect(onDocumentKeyDown).not.toHaveBeenCalled();
      expect(onEmojiSelect).not.toHaveBeenCalled();
    },
  );

  it('does not close on the Escape of an IME composition', async () => {
    const onClickOutside = vi.fn();
    render(
      <EmojiPicker onClickOutside={onClickOutside} onEmojiSelect={vi.fn()} />,
      { wrapper: AppWrapper },
    );
    await screen.findAllByRole('gridcell');
    const search = screen.getByRole('searchbox', { name: 'Search' });

    fireEvent.keyDown(search, { key: 'Escape', isComposing: true });
    expect(onClickOutside).not.toHaveBeenCalled();

    fireEvent.keyDown(search, { key: 'Escape' });
    expect(onClickOutside).toHaveBeenCalledTimes(1);
  });

  it('announces when nothing matches the search', async () => {
    const { search } = await renderInStoppingAncestor();

    fireEvent.change(search, { target: { value: 'zzzqqqxxx' } });

    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith('No results found...', 'polite'),
    );
  });

  it('names the skin tone button with a translatable label', async () => {
    await renderInStoppingAncestor();

    expect(
      screen.getByRole('button', { name: /^Change skin tone/ }),
    ).toBeInTheDocument();
  });
});
