import { StyleSchema } from '@blocknote/core';
import { ReactCustomInlineContentRenderProps } from '@blocknote/react';
import type { SizeOptions } from '@floating-ui/react';
import { Popover } from '@mantine/core';
import { announce } from '@react-aria/live-announcer';
import { useCommandState } from 'cmdk';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Card, QuickSearch, Text } from '@/components';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { DocSearch } from '@/docs/doc-search/api/useSearchDocs';
import { useDocSearchFilterStore } from '@/docs/doc-search/stores/useDocSearchFilterStore';
import { useResponsiveStore } from '@/stores';

import { InterlinkingSearchGroup } from './Interlinking';
import { MentionSearchInlineContentType } from './MentionSearchInlineContent';
import { UserMentionSearchGroup, useSearchUserMention } from './UserMention';
import { MentionedInlineContent } from './types';
import { moveCursorAfterMention } from './utils';

const inputStyle = css`
  background-color: transparent;
  border: none;
  outline: none;
  color: var(--c--globals--colors--gray-700);
  font-size: var(--c--globals--font--sizes--md);
  width: 100%;
  font-family: 'Inter';
`;

const DROPDOWN_MAX_HEIGHT = 500;

/**
 * The results scroll after 500px, or before when the viewport is too small:
 * the room left is given to the results through a CSS variable.
 */
const dropdownSizeMiddleware: SizeOptions = {
  // Keeps the margins of the results and a gap with the edge of the viewport
  padding: 24,
  apply: ({ availableHeight, elements }) => {
    elements.floating.style.setProperty(
      '--docs--mention-search-max-height',
      `${Math.max(0, Math.min(DROPDOWN_MAX_HEIGHT, availableHeight))}px`,
    );
  },
};

type ReactMentionSearch = ReactCustomInlineContentRenderProps<
  MentionSearchInlineContentType,
  StyleSchema
>;

/**
 * The search replaces itself by the content the user picked. At runtime
 * `updateInlineContent` accepts any inline content, but it is typed with the
 * one of the search.
 */
type ReplaceByMentioned = (inlineContent: MentionedInlineContent) => void;

/**
 * The search input lives outside of cmdk: it is told when the highlighted
 * option changes, to point at it with `aria-activedescendant`. The
 * `selectedItemId` of cmdk is not used, it misses the first highlight.
 */
const HighlightListener = ({ onHighlight }: { onHighlight: () => void }) => {
  const highlighted = useCommandState((state) => state.value);

  useEffect(() => {
    onHighlight();
  }, [highlighted, onHighlight]);

  return null;
};

export const Search = ({
  contentRef,
  updateInlineContent,
  editor,
  inlineContent,
  getPos,
}: ReactMentionSearch) => {
  const trigger = inlineContent.props.trigger;
  const isMentionTrigger = trigger === '@';
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const { isDesktop } = useResponsiveStore();
  const isEditable = editor.isEditable;
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [listboxId, setListboxId] = useState<string>();
  const [highlightedOptionId, setHighlightedOptionId] = useState<string>();
  const [popoverOpened, setPopoverOpened] = useState(false);
  const { setFilter } = useDocSearchFilterStore();
  const [docsCount, setDocsCount] = useState(0);
  const [docsLoading, setDocsLoading] = useState(true);
  const onDocsResults = useCallback(
    (results: DocSearch[]) => setDocsCount(results.length),
    [],
  );

  /**
   * cmdk gives its own id to the listbox, the input needs it to control it.
   */
  const setModalRef = useCallback((node: HTMLDivElement | null) => {
    modalRef.current = node;
    setListboxId(node?.querySelector('[cmdk-list]')?.id);
  }, []);

  const onHighlight = useCallback(() => {
    setHighlightedOptionId(
      modalRef.current?.querySelector('[cmdk-item][aria-selected="true"]')?.id,
    );
  }, []);

  /**
   * When the search is opened, we set the search
   * target to 'current' to limit the search to the current
   * document and its sub-documents.
   */
  useEffect(() => {
    setFilter('current');
  }, [setFilter]);

  /**
   * createReactInlineContentSpec add automatically the focus after
   * the inline content, so we need to set the focus on the input
   * after the component is mounted.
   * We also defer opening the popover to after mount so that
   * floating-ui attaches scroll/resize listeners correctly.
   */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      setPopoverOpened(true);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  const closeSearch = (insertContent: string) => {
    if (!isEditable) {
      return;
    }

    updateInlineContent({
      type: 'mentionSearchInline',
      props: {
        disabled: true,
      },
    });

    editor.focus();

    if (insertContent) {
      contentRef(null);
      editor.focus();
      (editor as DocsBlockNoteEditor).insertInlineContent([insertContent]);
    }
  };

  /**
   * Pick a mentioned user from the search results.
   * @param mentioned
   * @returns
   */
  const pick = (mentioned: MentionedInlineContent) => {
    if (!isEditable) {
      return;
    }

    const pos = getPos();

    (updateInlineContent as unknown as ReplaceByMentioned)(mentioned);

    contentRef(null);
    editor.focus();

    if (pos !== undefined) {
      moveCursorAfterMention(editor as DocsBlockNoteEditor, pos);
    }
  };

  /**
   * Users can be mentioned only when the search is opened with "@",
   * not with the slash menu.
   */
  const { users, selectUser } = useSearchUserMention({
    editor: editor as DocsBlockNoteEditor,
    getPos,
    search,
    enabled: isMentionTrigger,
    onPick: pick,
  });

  const hasUsers = users.length > 0;
  const nothingFound = !docsLoading && docsCount === 0 && !hasUsers;
  const wasNothingFound = useRef(false);
  const hadUsers = useRef(false);

  /**
   * cmdk highlights the first option only when the list mounts. The first
   * option is highlighted again when the users arrive above the docs, and
   * when the highlighted option went away, without remounting the list that
   * the screen readers would announce again.
   */
  useEffect(() => {
    const list = modalRef.current?.querySelector('[cmdk-list]');
    const usersArrived = hasUsers && !hadUsers.current;
    hadUsers.current = hasUsers;
    // The highlighted option may have gone away with nothing to replace it
    onHighlight();

    if (
      !list ||
      (!usersArrived && list.querySelector('[cmdk-item][aria-selected="true"]'))
    ) {
      return;
    }

    list.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Home',
        bubbles: true,
        cancelable: true,
      }),
    );
  }, [hasUsers, users, docsCount, onHighlight]);

  /**
   * With "@" the search of the docs is silent, the users and the docs are
   * announced together, once, when nothing matches the typed text any more.
   */
  useEffect(() => {
    if (!isMentionTrigger || docsLoading) {
      return;
    }

    if (nothingFound && !wasNothingFound.current) {
      announce(t('No results found...'), 'polite');
    }

    wasNothingFound.current = nothingFound;
  }, [isMentionTrigger, docsLoading, nothingFound, t]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // Keep the trigger character and typed text in the editor when closing with Escape
      closeSearch(`${trigger}${search}`);
    } else if (e.key === 'Backspace' && search.length === 0) {
      e.preventDefault();
      closeSearch('');
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Allow arrow keys to be handled by the command menu for navigation
      const commandList = modalRef.current?.querySelector('[cmdk-list]');

      // Create a synthetic keyboard event for the command menu
      const syntheticEvent = new KeyboardEvent('keydown', {
        key: e.key,
        bubbles: true,
        cancelable: true,
      });
      commandList?.dispatchEvent(syntheticEvent);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      // Handle Enter key to select the currently highlighted item
      const selectedItem = modalRef.current?.querySelector(
        '[cmdk-item][data-selected="true"]',
      ) as HTMLElement;

      selectedItem?.click();
      e.preventDefault();
    }
  };

  return (
    <Box as="span" $position="relative">
      <Popover
        position="bottom"
        opened={popoverOpened}
        withinPortal={true}
        hideDetached={false}
        withRoles={false}
        middlewares={{ size: dropdownSizeMiddleware }}
      >
        <Popover.Target>
          <Box
            as="span"
            className="inline-content"
            $background="var(--c--contextuals--background--semantic--overlay--primary)"
            $color="var(--c--contextuals--content--semantic--neutral--primary)"
            $direction="row"
            $radius="3px"
            $padding="2px"
            $display="inline-flex"
            tabIndex={-1} // Ensure the span is focusable
          >
            {' '}
            <Box as="span" aria-hidden="true" $height="25px">
              {trigger}
            </Box>
            <Box
              as="input"
              name="doc-search-input"
              role="combobox"
              aria-label={
                isMentionTrigger
                  ? t('Search for a person or a document', {
                      description:
                        'Accessible name of the field to search a person or a document to mention in the editor',
                    })
                  : t('Search for a document', {
                      description:
                        'Accessible name or placeholder of a document search field',
                    })
              }
              aria-expanded={popoverOpened}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                popoverOpened ? highlightedOptionId : undefined
              }
              $padding={{ left: '3px' }}
              placeholder={
                isMentionTrigger
                  ? t('mention something', {
                      description:
                        'Placeholder of the field to search a person or a doc to mention in the editor',
                    })
                  : t('mention a sub-doc', {
                      description:
                        'Placeholder of the field to search a doc to link in the editor',
                    })
              }
              $css={inputStyle}
              ref={inputRef}
              $display="inline-flex"
              onInput={(e) => {
                const value = (e.target as HTMLInputElement).value;
                setSearch(value);
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
          </Box>
        </Popover.Target>
        <Popover.Dropdown>
          <Box
            ref={setModalRef}
            $minWidth={isDesktop ? '330px' : '220px'}
            $width="fit-content"
            $zIndex="10"
            $css={css`
              position: relative;

              .mantine-Popover-dropdown[data-position='bottom'] & {
                top: -10px;
              }
              .mantine-Popover-dropdown[data-position='top'] & {
                top: 10px;
              }

              & .quick-search-container [cmdk-root] {
                border-radius: inherit;
                background: transparent;
              }
            `}
          >
            <QuickSearch
              showInput={false}
              isSelectByDefault
              listLabel={t('Search results', {
                description:
                  'Accessible name or heading of the list of search results',
              })}
            >
              <HighlightListener onHighlight={onHighlight} />
              <Card
                $css={css`
                  box-shadow: 0 0 6px 0 rgba(0, 0, 145, 0.1);
                  border: 1px solid
                    var(--c--contextuals--border--surface--primary);
                  background: var(
                    --c--contextuals--background--surface--primary
                  );
                  max-height: var(
                    --docs--mention-search-max-height,
                    ${DROPDOWN_MAX_HEIGHT}px
                  );
                  overflow-y: auto;
                  .quick-search-container & [cmdk-group] {
                    margin-top: 0 !important;
                  }
                  & > div {
                    margin-top: var(--c--globals--spacings--0);
                    & [cmdk-group-heading] {
                      padding: 0;
                      margin: 0;
                    }

                    & [cmdk-group-items] .ml-b {
                      margin-left: 0rem;
                      padding: 0.5rem;
                      font-size: 14px;
                      display: block;
                    }

                    & [cmdk-item] {
                      border-radius: 0;
                    }

                    & .--docs--doc-search-item > div {
                      gap: 0.8rem;
                    }

                    & .--docs--quick-search-group-title {
                      padding: var(--c--globals--spacings--sm);
                    }

                    & .--docs--quick-search-group-empty {
                      margin: var(--c--globals--spacings--sm);
                    }
                  }
                `}
                $margin="sm"
                $padding="none"
              >
                <UserMentionSearchGroup users={users} onSelect={selectUser} />
                <InterlinkingSearchGroup
                  search={search}
                  onPick={pick}
                  withSeparator={hasUsers && docsCount > 0}
                  silent={isMentionTrigger}
                  onResults={onDocsResults}
                  onLoadingChange={setDocsLoading}
                />
                {nothingFound && (
                  <Text
                    className="--docs--quick-search-group-empty"
                    $size="sm"
                    $padding="sm"
                  >
                    {isMentionTrigger
                      ? t('No results found...')
                      : t('No documents found...')}
                  </Text>
                )}
              </Card>
            </QuickSearch>
          </Box>
        </Popover.Dropdown>
      </Popover>
    </Box>
  );
};
