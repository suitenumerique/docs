import { StyleSchema } from '@blocknote/core';
import { ReactCustomInlineContentRenderProps } from '@blocknote/react';
import { Popover } from '@mantine/core';
import type { KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Card, QuickSearch } from '@/components';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { useDocSearchFilterStore } from '@/docs/doc-search/stores/useDocSearchFilterStore';
import { useResponsiveStore } from '@/stores';

import { InterlinkingSearchGroup } from './Interlinking';
import { MentionSearchInlineContentType } from './MentionSearchInlineContent';
import { MentionedInlineContent } from './types';

const inputStyle = css`
  background-color: transparent;
  border: none;
  outline: none;
  color: var(--c--globals--colors--gray-700);
  font-size: var(--c--globals--font--sizes--md);
  width: 100%;
  font-family: 'Inter';
`;

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

export const Search = ({
  contentRef,
  updateInlineContent,
  editor,
  inlineContent,
}: ReactMentionSearch) => {
  const trigger = inlineContent.props.trigger;
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const { isDesktop } = useResponsiveStore();
  const isEditable = editor.isEditable;
  const modalRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();
  const [popoverOpened, setPopoverOpened] = useState(false);
  const { setFilter } = useDocSearchFilterStore();

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

  const pick = (mentioned: MentionedInlineContent) => {
    if (!isEditable) {
      return;
    }

    (updateInlineContent as unknown as ReplaceByMentioned)(mentioned);

    contentRef(null);
    editor.focus();
  };

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
              aria-label={t('Search for a document')}
              aria-expanded={popoverOpened}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-controls={dropdownId}
              $padding={{ left: '3px' }}
              placeholder={t('mention a sub-doc...')}
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
            ref={modalRef}
            id={dropdownId}
            role="listbox"
            aria-label={t('Search results')}
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
            <QuickSearch showInput={false} isSelectByDefault>
              <Card
                $css={css`
                  box-shadow: 0 0 6px 0 rgba(0, 0, 145, 0.1);
                  border: 1px solid
                    var(--c--contextuals--border--surface--primary);
                  background: var(
                    --c--contextuals--background--surface--primary
                  );
                  .quick-search-container & [cmdk-group] {
                    margin-top: 0 !important;
                  }
                  & h2 {
                    padding: var(--c--globals--spacings--sm);
                  }
                  & > div {
                    margin-top: var(--c--globals--spacings--0);
                    & [cmdk-group-heading] {
                      padding: 0.4rem;
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
                      font-size: 12px;
                      margin: var(--c--globals--spacings--sm);
                      margin-bottom: var(--c--globals--spacings--xxs);
                    }

                    & .--docs--quick-search-group-empty {
                      margin: var(--c--globals--spacings--sm);
                    }
                  }
                `}
                $margin="sm"
                $padding="none"
              >
                <InterlinkingSearchGroup search={search} onPick={pick} />
              </Card>
            </QuickSearch>
          </Box>
        </Popover.Dropdown>
      </Popover>
    </Box>
  );
};
