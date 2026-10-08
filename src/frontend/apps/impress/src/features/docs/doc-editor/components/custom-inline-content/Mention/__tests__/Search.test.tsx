import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { Doc, useDocStore } from '@/docs/doc-management';
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

import { Search } from '../Search';

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

const BLOCK_ID = 'a3a5bd0d-4b2f-4a7c-9c1e-5a5e8e1d2f10';

const renderSearch = async ({
  isEditable = true,
  trigger = '/',
  blockId = BLOCK_ID,
} = {}) => {
  const updateInlineContent = vi.fn();
  const contentRef = vi.fn();
  const insertInlineContent = vi.fn();
  const focus = vi.fn();

  const editor = {
    isEditable,
    focus,
    insertInlineContent,
    // Used to find the block containing the search
    transact: (callback: (tr: unknown) => unknown) =>
      callback({
        doc: {
          nodeAt: () => null,
          resolve: () => ({
            depth: 0,
            node: () => ({
              type: { isInGroup: () => true },
              attrs: { id: blockId },
            }),
          }),
        },
      }),
  } as unknown as DocsBlockNoteEditor;

  render(
    <Search
      editor={editor as any}
      inlineContent={
        {
          type: 'mentionSearchInline',
          props: { trigger, disabled: false },
        } as any
      }
      updateInlineContent={updateInlineContent}
      contentRef={contentRef}

      node={{} as any}
      getPos={() => 12}
    />,
    { wrapper: Wrapper },
  );

  // Search focuses the input and opens the popover after a 100ms timeout.
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());

  return { updateInlineContent, contentRef, insertInlineContent, focus };
};

describe('Search', () => {
  beforeEach(() => {
    capturedProps.length = 0;
    useDocSearchFilterStore.setState({ filter: 'all' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('limits the search to the current doc subtree on mount', async () => {
    await renderSearch();

    expect(useDocSearchFilterStore.getState().filter).toBe('current');
  });

  it('renders the trigger character and focuses the search input', async () => {
    await renderSearch({ trigger: '@' });

    expect(screen.getByText('@')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('forwards the typed text to the search results', async () => {
    await renderSearch();

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
    const { updateInlineContent, contentRef, focus } = await renderSearch();

    fireEvent.click(await screen.findByText('First result'));

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'interlinkingLinkInline',
      props: { docId: 'doc-1' },
    });
    expect(contentRef).toHaveBeenCalledWith(null);
    expect(focus).toHaveBeenCalled();
  });

  it('ignores a selection when the editor is not editable', async () => {
    const { updateInlineContent } = await renderSearch({
      isEditable: false,
    });

    fireEvent.click(await screen.findByText('First result'));

    expect(updateInlineContent).not.toHaveBeenCalled();
  });

  it('closes and re-inserts the trigger and typed text on Escape', async () => {
    const { updateInlineContent, insertInlineContent, focus } =
      await renderSearch({ trigger: '/' });

    fireEvent.input(screen.getByRole('combobox'), {
      target: { value: 'abc' },
    });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'mentionSearchInline',
      props: { disabled: true },
    });
    expect(focus).toHaveBeenCalled();
    expect(insertInlineContent).toHaveBeenCalledWith(['/abc']);
  });

  it('closes without inserting anything on Backspace when the search is empty', async () => {
    const { updateInlineContent, insertInlineContent } = await renderSearch();

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' });

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'mentionSearchInline',
      props: { disabled: true },
    });
    expect(insertInlineContent).not.toHaveBeenCalled();
  });

  it('lets a Backspace with existing text fall through to normal editing', async () => {
    const { updateInlineContent } = await renderSearch();

    fireEvent.input(screen.getByRole('combobox'), {
      target: { value: 'abc' },
    });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' });

    expect(updateInlineContent).not.toHaveBeenCalled();
  });

  it('moves the highlighted result with ArrowDown/ArrowUp and selects it on Enter', async () => {
    const { updateInlineContent } = await renderSearch();

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

describe('Search with the "@" trigger', () => {
  const DOC_ID = 'a1b2c3d4-e5f6-4789-a123-1234567890ab';
  const ACCESSES_URL = `http://test.jest/api/v1.0/documents/${DOC_ID}/accesses/`;
  const MENTION_URL = `http://test.jest/api/v1.0/documents/${DOC_ID}/mention/`;

  const createAccess = (id: string, fullName: string, role = 'editor') => ({
    id: `access-${id}`,
    role,
    max_role: role,
    user: { id, full_name: fullName, short_name: fullName },
  });

  beforeEach(() => {
    capturedProps.length = 0;
    useDocSearchFilterStore.setState({ filter: 'all' });
    useDocStore.setState({
      currentDoc: {
        id: DOC_ID,
        abilities: { comment: true },
      } as unknown as Doc,
    });
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(ACCESSES_URL, [
      createAccess('user-1', 'Mehdi Daoudi', 'owner'),
      createAccess('user-2', 'Mehdi Benali'),
      createAccess('user-3', 'Sarah Reader', 'reader'),
    ]);
    fetchMock.post(MENTION_URL, { status: 201, body: { id: 'mention-id' } });
  });

  afterEach(() => {
    // The globals stay stubbed until the component is unmounted, as the
    // list may still re-render once the users are loaded.
    useDocStore.setState({ currentDoc: undefined });
  });

  it('proposes the users and the docs in two sections', async () => {
    await renderSearch({ trigger: '@' });

    expect(
      await screen.findByRole('heading', { name: 'Mention a person' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mehdi Daoudi')).toBeInTheDocument();
    expect(screen.getByText('Mehdi Benali')).toBeInTheDocument();
    expect(screen.queryByText('Sarah Reader')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Link a doc' }),
    ).toBeInTheDocument();
    expect(screen.getByText('First result')).toBeInTheDocument();
  });

  it('proposes only the docs when opened from the slash menu', async () => {
    await renderSearch({ trigger: '/' });

    await screen.findByText('First result');

    expect(
      screen.queryByRole('heading', { name: 'Mention a person' }),
    ).not.toBeInTheDocument();
    expect(fetchMock.callHistory.calls(ACCESSES_URL)).toHaveLength(0);
  });

  it('filters the users with the typed text', async () => {
    await renderSearch({ trigger: '@' });
    await screen.findByText('Mehdi Daoudi');

    fireEvent.input(screen.getByRole('combobox'), {
      target: { value: 'benali' },
    });

    await waitFor(() =>
      expect(screen.queryByText('Mehdi Daoudi')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Mehdi Benali')).toBeInTheDocument();
  });

  it('keeps an item highlighted when the typed text filters out the users', async () => {
    await renderSearch({ trigger: '@' });
    await screen.findByText('Mehdi Daoudi');

    fireEvent.input(screen.getByRole('combobox'), {
      target: { value: 'zzz' },
    });

    await waitFor(() =>
      expect(screen.queryByText('Mehdi Daoudi')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.getByText('First result').closest('[cmdk-item]'),
      ).toHaveAttribute('data-selected', 'true'),
    );
  });

  it('highlights the first user by default', async () => {
    await renderSearch({ trigger: '@' });

    expect(
      (await screen.findByText('Mehdi Daoudi')).closest('[cmdk-item]'),
    ).toHaveAttribute('data-selected', 'true');
  });

  it('replaces the search by a mention and notifies the user', async () => {
    const { updateInlineContent, contentRef, focus } = await renderSearch({
      trigger: '@',
    });

    fireEvent.click(await screen.findByText('Mehdi Benali'));

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'userMentionInline',
      props: { userId: 'user-2', fullName: 'Mehdi Benali' },
    });
    expect(contentRef).toHaveBeenCalledWith(null);
    expect(focus).toHaveBeenCalled();

    await waitFor(() =>
      expect(fetchMock.callHistory.calls(MENTION_URL)).toHaveLength(1),
    );
    expect(
      JSON.parse(
        fetchMock.callHistory.lastCall(MENTION_URL)?.options.body as string,
      ),
    ).toEqual({ anchor_id: BLOCK_ID, mentioned_user_id: 'user-2' });
  });

  it('keeps the mention but does not notify when the block id is not a uuid', async () => {
    const { updateInlineContent } = await renderSearch({
      trigger: '@',
      blockId: 'not-a-uuid',
    });

    fireEvent.click(await screen.findByText('Mehdi Benali'));

    expect(updateInlineContent).toHaveBeenCalled();
    expect(fetchMock.callHistory.calls(MENTION_URL)).toHaveLength(0);
  });

  it('ignores the selection of a user when the editor is not editable', async () => {
    const { updateInlineContent } = await renderSearch({
      trigger: '@',
      isEditable: false,
    });

    fireEvent.click(await screen.findByText('Mehdi Benali'));

    expect(updateInlineContent).not.toHaveBeenCalled();
    expect(fetchMock.callHistory.calls(MENTION_URL)).toHaveLength(0);
  });

  it('still links a doc', async () => {
    const { updateInlineContent } = await renderSearch({ trigger: '@' });

    fireEvent.click(await screen.findByText('Second result'));

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'interlinkingLinkInline',
      props: { docId: 'doc-2' },
    });
    expect(fetchMock.callHistory.calls(MENTION_URL)).toHaveLength(0);
  });

  it('navigates through the users and the docs as a single list', async () => {
    const { updateInlineContent } = await renderSearch({ trigger: '@' });

    await screen.findByText('Mehdi Daoudi');
    const input = screen.getByRole('combobox');
    const isSelected = (text: string) =>
      screen
        .getByText(text)
        .closest('[cmdk-item]')
        ?.getAttribute('data-selected');

    expect(isSelected('Mehdi Daoudi')).toBe('true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(isSelected('Mehdi Benali')).toBe('true');

    // Moves from the last user to the first doc
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(isSelected('First result')).toBe('true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(isSelected('Mehdi Benali')).toBe('true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'interlinkingLinkInline',
      props: { docId: 'doc-1' },
    });
  });

  it('selects the highlighted user with Enter', async () => {
    const { updateInlineContent } = await renderSearch({ trigger: '@' });

    await screen.findByText('Mehdi Daoudi');
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'userMentionInline',
      props: { userId: 'user-1', fullName: 'Mehdi Daoudi' },
    });
  });

  it('keeps the trigger and the typed text on Escape', async () => {
    const { updateInlineContent, insertInlineContent } = await renderSearch({
      trigger: '@',
    });

    await screen.findByText('Mehdi Daoudi');
    fireEvent.input(screen.getByRole('combobox'), {
      target: { value: 'meh' },
    });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

    expect(updateInlineContent).toHaveBeenCalledWith({
      type: 'mentionSearchInline',
      props: { disabled: true },
    });
    expect(insertInlineContent).toHaveBeenCalledWith(['@meh']);
  });
});
