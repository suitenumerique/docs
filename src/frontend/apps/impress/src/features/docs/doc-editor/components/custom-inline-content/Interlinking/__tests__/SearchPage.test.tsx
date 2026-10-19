import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { useDocSearchFilterStore } from '@/docs/doc-search/stores/useDocSearchFilterStore';
import { AppWrapper } from '@/tests/utils';

const Wrapper = ({ children }: PropsWithChildren) => (
  <AppWrapper>
    <MantineProvider>{children}</MantineProvider>
  </AppWrapper>
);

const { capturedProps } = vi.hoisted(() => ({
  capturedProps: [] as unknown[],
}));

const FAKE_DOCS = [
  { id: 'doc-1', title: 'First result' },
  { id: 'doc-2', title: 'Second result' },
];

vi.mock('@/docs/doc-search', async () => {
  const { QuickSearchGroup } = await vi.importActual<
    typeof import('@/components/quick-search')
  >('@/components/quick-search');

  return {
    DocSearchContent: (props: any) => {
      capturedProps.push(props);
      return (
        <QuickSearchGroup
          group={{ groupName: props.groupName, elements: FAKE_DOCS }}
          onSelect={props.onSelect}
          renderElement={(doc: (typeof FAKE_DOCS)[number]) => doc.title}
        />
      );
    },
  };
});

import { SearchPage } from '../SearchPage';

// cmdk and Mantine rely on browser APIs jsdom doesn't implement.
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
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

const renderSearchPage = async ({ isEditable = true, trigger = '/' } = {}) => {
  const updateInlineContent = vi.fn();
  const contentRef = vi.fn();
  const insertInlineContent = vi.fn();
  const focus = vi.fn();

  const editor = {
    isEditable,
    focus,
    insertInlineContent,
  } as unknown as DocsBlockNoteEditor;

  render(
    <SearchPage
      editor={editor as any}
      inlineContent={
        {
          type: 'interlinkingLinkInline',
          props: { trigger, disabled: false, docId: '' },
        } as any
      }
      updateInlineContent={updateInlineContent}
      contentRef={contentRef}

      node={{} as any}
      getPos={() => undefined}
    />,
    { wrapper: Wrapper },
  );

  // SearchPage focuses the input and opens the popover after a 100ms timeout.
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());

  return { updateInlineContent, contentRef, insertInlineContent, focus };
};

describe('SearchPage', () => {
  beforeEach(() => {
    capturedProps.length = 0;
    useDocSearchFilterStore.setState({ filter: 'all' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('limits the search to the current doc subtree on mount', async () => {
    await renderSearchPage();

    expect(useDocSearchFilterStore.getState().filter).toBe('current');
  });

  it('renders the trigger character and focuses the search input', async () => {
    await renderSearchPage({ trigger: '@' });

    expect(screen.getByText('@')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('forwards the typed text to the search results', async () => {
    await renderSearchPage();

    fireEvent.input(screen.getByRole('combobox'), {
      target: { value: 'my query' },
    });

    await waitFor(() => {
      const lastCall = capturedProps[capturedProps.length - 1] as {
        search: string;
      };
      expect(lastCall.search).toBe('my query');
    });
  });

  it('selects a result and inserts the interlink', async () => {
    const { updateInlineContent, contentRef, focus } = await renderSearchPage();

    fireEvent.click(await screen.findByText('First result'));

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'interlinkingLinkInline',
      props: { docId: 'doc-1' },
    });
    expect(contentRef).toHaveBeenCalledWith(null);
    expect(focus).toHaveBeenCalled();
  });

  it('ignores a selection when the editor is not editable', async () => {
    const { updateInlineContent } = await renderSearchPage({
      isEditable: false,
    });

    fireEvent.click(await screen.findByText('First result'));

    expect(updateInlineContent).not.toHaveBeenCalled();
  });

  it('closes and re-inserts the trigger and typed text on Escape', async () => {
    const { updateInlineContent, insertInlineContent, focus } =
      await renderSearchPage({ trigger: '/' });

    fireEvent.input(screen.getByRole('combobox'), {
      target: { value: 'abc' },
    });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'interlinkingLinkInline',
      props: { disabled: true },
    });
    expect(focus).toHaveBeenCalled();
    expect(insertInlineContent).toHaveBeenCalledWith(['/abc']);
  });

  it('closes without inserting anything on Backspace when the search is empty', async () => {
    const { updateInlineContent, insertInlineContent } =
      await renderSearchPage();

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' });

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'interlinkingLinkInline',
      props: { disabled: true },
    });
    expect(insertInlineContent).not.toHaveBeenCalled();
  });

  it('lets a Backspace with existing text fall through to normal editing', async () => {
    const { updateInlineContent } = await renderSearchPage();

    fireEvent.input(screen.getByRole('combobox'), {
      target: { value: 'abc' },
    });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' });

    expect(updateInlineContent).not.toHaveBeenCalled();
  });

  it('moves the highlighted result with ArrowDown/ArrowUp and selects it on Enter', async () => {
    const { updateInlineContent } = await renderSearchPage();

    await screen.findByText('First result');
    const input = screen.getByRole('combobox');

    // The first result is highlighted by default.
    expect(
      screen.getByText('First result').closest('[cmdk-item]'),
    ).toHaveAttribute('data-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(
      screen.getByText('Second result').closest('[cmdk-item]'),
    ).toHaveAttribute('data-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(
      screen.getByText('First result').closest('[cmdk-item]'),
    ).toHaveAttribute('data-selected', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'interlinkingLinkInline',
      props: { docId: 'doc-1' },
    });
  });
});
