import {
  PartialCustomInlineContentFromConfig,
  StyleSchema,
} from '@blocknote/core';
import { useBlockNoteEditor } from '@blocknote/react';
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  Card,
  Icon,
  QuickSearch,
  QuickSearchGroup,
  QuickSearchItemContent,
  Text,
} from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '@/docs/doc-editor';
import FoundPageIcon from '@/docs/doc-editor/assets/doc-found.svg';
import AddPageIcon from '@/docs/doc-editor/assets/doc-plus.svg';
import {
  Doc,
  getEmojiAndTitle,
  useCreateChildDocTree,
  useDocStore,
  useTrans,
} from '@/docs/doc-management';
import { DocSearchTarget } from '@/docs/doc-search';
import { DocSearchContent } from '@/docs/doc-search/components/DocSearchContent';
import { useResponsiveStore } from '@/stores';

const inputStyle = css`
  background-color: var(--c--globals--colors--gray-100);
  border: none;
  outline: none;
  color: var(--c--globals--colors--gray-700);
  font-size: var(--c--globals--font--sizes--md);
  width: 100%;
  font-family: 'Inter';
`;

type SearchPageProps = {
  trigger: '/' | '@';
  updateInlineContent: (
    update: PartialCustomInlineContentFromConfig<
      {
        type: 'interlinkingSearchInline';
        propSchema: {
          disabled: {
            default: false;
            values: [true, false];
          };
          trigger: {
            default: '/';
            values: ['/', '@'];
          };
        };
        content: 'styled';
      },
      StyleSchema
    >,
  ) => void;
  contentRef: (node: HTMLElement | null) => void;
};

export const SearchPage = ({
  contentRef,
  trigger,
  updateInlineContent,
}: SearchPageProps) => {
  const { colorsTokens } = useCunninghamTheme();
  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();
  const { t } = useTranslation();
  const { currentDoc } = useDocStore();
  const createChildDoc = useCreateChildDocTree(currentDoc?.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const { isDesktop } = useResponsiveStore();
  const { untitledDocument } = useTrans();
  const isEditable = editor.isEditable;
  const treeContext = useTreeContext<Doc>();
  /**
   * createReactInlineContentSpec add automatically the focus after
   * the inline content, so we need to set the focus on the input
   * after the component is mounted.
   */
  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  }, [inputRef]);

  const closeSearch = (insertContent: string) => {
    if (!isEditable) {
      return;
    }

    updateInlineContent({
      type: 'interlinkingSearchInline',
      props: {
        disabled: true,
        trigger,
      },
    });

    contentRef(null);
    editor.focus();
    editor.insertInlineContent([insertContent]);
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
      const commandList = e.currentTarget
        .closest('.inline-content')
        ?.nextElementSibling?.querySelector('[cmdk-list]');

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
      const selectedItem = e.currentTarget
        .closest('.inline-content')
        ?.nextElementSibling?.querySelector(
          '[cmdk-item][data-selected="true"]',
        ) as HTMLElement;

      selectedItem?.click();
      e.preventDefault();
    }
  };

  return (
    <Box as="span" $position="relative">
      <Box
        as="span"
        className="inline-content"
        $background={colorsTokens['gray-100']}
        $color="var(--c--globals--colors--gray-700)"
        $direction="row"
        $radius="3px"
        $padding="1px"
        $display="inline-flex"
        tabIndex={-1} // Ensure the span is focusable
      >
        {' '}
        {trigger}
        <Box
          as="input"
          name="doc-search-input"
          $padding={{ left: '3px' }}
          $css={inputStyle}
          ref={inputRef}
          $display="inline-flex"
          onInput={(e) => {
            const value = (e.target as HTMLInputElement).value;
            setSearch(value);
          }}
          onKeyDown={handleKeyDown}
        />
      </Box>
      <Box
        $minWidth={isDesktop ? '330px' : '220px'}
        $width="fit-content"
        $position="absolute"
        $css={css`
          top: 28px;
          z-index: 1000;

          & .quick-search-container [cmdk-root] {
            border-radius: inherit;
          }
        `}
      >
        <QuickSearch showInput={false}>
          <Card
            $css={css`
              box-shadow: 0 0 3px 0px var(--c--globals--colors--gray-200);
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
              }
            `}
            $margin={{ top: '0.5rem' }}
          >
            <DocSearchContent
              search={search}
              target={DocSearchTarget.CURRENT}
              parentPath={treeContext?.root?.path}
              onSelect={(doc) => {
                if (!isEditable) {
                  return;
                }
                updateInlineContent({
                  type: 'interlinkingSearchInline',
                  props: {
                    disabled: true,
                    trigger,
                  },
                });

                contentRef(null);

                editor.insertInlineContent([
                  {
                    type: 'interlinkingLinkInline',
                    props: {
                      docId: doc.id,
                      title: doc.title || untitledDocument,
                    },
                  },
                ]);

                editor.focus();
              }}
              renderElement={(doc) => {
                const { emoji, titleWithoutEmoji } = getEmojiAndTitle(
                  doc.title || untitledDocument,
                );

                return (
                  <QuickSearchItemContent
                    left={
                      <Box
                        $direction="row"
                        $gap="0.2rem"
                        $align="center"
                        $padding={{ vertical: '0.5rem', horizontal: '0.2rem' }}
                        $width="100%"
                      >
                        <Box
                          $css={css`
                            width: 24px;
                            flex-shrink: 0;
                          `}
                        >
                          {emoji ? (
                            <Text $size="18px">{emoji}</Text>
                          ) : (
                            <FoundPageIcon
                              width="100%"
                              style={{ maxHeight: '24px' }}
                            />
                          )}
                        </Box>

                        <Text
                          $size="sm"
                          $color="var(--c--globals--colors--gray-1000)"
                          spellCheck="false"
                        >
                          {titleWithoutEmoji}
                        </Text>
                      </Box>
                    }
                    right={
                      <Icon iconName="keyboard_return" spellCheck="false" />
                    }
                  />
                );
              }}
            />
            <QuickSearchGroup
              group={{
                groupName: '',
                elements: [],
                endActions: [
                  {
                    onSelect: createChildDoc,
                    content: (
                      <Box
                        $css={css`
                          border-top: 1px solid
                            var(--c--globals--colors--gray-200);
                        `}
                        $width="100%"
                      >
                        <Box
                          $direction="row"
                          $gap="0.4rem"
                          $align="center"
                          $padding={{
                            vertical: '0.5rem',
                            horizontal: '0.3rem',
                          }}
                          $css={css`
                            &:hover {
                              background-color: var(
                                --c--globals--colors--gray-100
                              );
                            }
                          `}
                        >
                          <AddPageIcon />
                          <Text
                            $size="sm"
                            $color="var(--c--globals--colors--gray-1000)"
                            contentEditable={false}
                          >
                            {t('New sub-doc')}
                          </Text>
                        </Box>
                      </Box>
                    ),
                  },
                ],
              }}
            />
          </Card>
        </QuickSearch>
      </Box>
    </Box>
  );
};
