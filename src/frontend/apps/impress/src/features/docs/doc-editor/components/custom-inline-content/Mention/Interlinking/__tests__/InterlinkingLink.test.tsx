import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InterlinkingLink } from '../InterlinkingLinkInlineContent';

vi.mock('../LinkSelected', () => ({
  LinkSelected: ({ docId, blockId }: { docId: string; blockId?: string }) => (
    <span data-testid="link-selected">{`${docId}#${blockId ?? ''}`}</span>
  ),
}));

const DOC_ID = '6f1e4c9a-2f6b-4a3e-9d5c-1b2a3c4d5e6f';

/**
 * The documents saved before the search of the mentions got its own inline
 * content still hold `interlinkingLinkInline` in its former search states.
 */
describe('InterlinkingLink', () => {
  it('renders the linked doc', () => {
    render(
      <InterlinkingLink
        docId={DOC_ID}
        blockId="block-1"
        isEditable
        onDisable={vi.fn()}
      />,
    );

    expect(screen.getByTestId('link-selected')).toHaveTextContent(
      `${DOC_ID}#block-1`,
    );
  });

  it('renders nothing for the former search state, without docId', () => {
    const { container } = render(
      <InterlinkingLink docId="" isEditable onDisable={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for the former closed search state, disabled', () => {
    const { container } = render(
      <InterlinkingLink docId="" disabled isEditable onDisable={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('disables a link to an invalid doc id', async () => {
    const onDisable = vi.fn();

    const { container } = render(
      <InterlinkingLink docId="not-a-uuid" isEditable onDisable={onDisable} />,
    );

    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(onDisable).toHaveBeenCalledTimes(1));
  });
});
