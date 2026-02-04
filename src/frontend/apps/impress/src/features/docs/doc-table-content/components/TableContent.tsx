import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  DocsBlockNoteEditor,
  HeadingBlock,
  useEditorStore,
  useHeadingStore,
} from '@/docs/doc-editor';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';

import { Heading } from './Heading';

export const TableContent = () => {
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const [containerHeight, setContainerHeight] = useState('100vh');
  const { headings } = useHeadingStore();
  const { editor } = useEditorStore();

  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Calculate container height based on the scrollable content
   */
  useEffect(() => {
    const mainLayout = document.getElementById(MAIN_LAYOUT_ID);
    if (mainLayout) {
      setContainerHeight(`${mainLayout.scrollHeight}px`);
    }
  }, []);

  const onOpen = () => {
    setIsOpen(true);
  };

  if (
    !editor ||
    !headings ||
    headings.length === 0 ||
    (headings.length === 1 && !headings[0].contentText)
  ) {
    return null;
  }

  return (
    <Box
      $height={containerHeight}
      $position="absolute"
      $css={css`
        top: 72px;
        right: 20px;
      `}
    >
      <Box
        as="nav"
        id="summaryContainer"
        $width={!isOpen ? '40px' : '200px'}
        $height={!isOpen ? '40px' : 'auto'}
        $maxHeight="calc(50vh - 60px)"
        $zIndex={1000}
        $align="center"
        $padding={isOpen ? 'xs' : '0'}
        $justify="center"
        $position="sticky"
        aria-label={t('Summary')}
        $css={css`
          top: var(--c--globals--spacings--0);
          border: 1px solid ${colorsTokens['brand-100']};
          overflow: hidden;
          border-radius: ${spacingsTokens['3xs']};
          background: var(--c--contextuals--background--surface--primary);
          ${isOpen &&
          css`
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: flex-start;
            gap: ${spacingsTokens['2xs']};
          `}
        `}
        className="--docs--table-content"
      >
        {!isOpen && (
          <BoxButton
            onClick={onOpen}
            $width="100%"
            $height="100%"
            $justify="center"
            $align="center"
            aria-label={t('Summary')}
            aria-expanded={isOpen}
            aria-controls="toc-list"
            $css={css`
              &:focus-visible {
                outline: none;
                box-shadow: 0 0 0 4px ${colorsTokens['brand-400']};
                background: ${colorsTokens['brand-100']};
                width: 90%;
                height: 90%;
              }
            `}
          >
            <Icon
              $theme="brand"
              $variation="tertiary"
              iconName="list"
              variant="symbols-outlined"
            />
          </BoxButton>
        )}
        {isOpen && (
          <TableContentOpened
            setIsOpen={setIsOpen}
            headings={headings}
            editor={editor}
          />
        )}
      </Box>
    </Box>
  );
};

const TableContentOpened = ({
  setIsOpen,
  headings,
  editor,
}: {
  setIsOpen: (isOpen: boolean) => void;
  headings: HeadingBlock[];
  editor: DocsBlockNoteEditor;
}) => {
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const [headingIdHighlight, setHeadingIdHighlight] = useState<string>();
  const { t } = useTranslation();

  /**
   * Handle scroll to highlight the current heading in the table of content
   */
  useEffect(() => {
    const handleScroll = () => {
      if (!headings) {
        return;
      }

      for (const heading of headings) {
        const elHeading = document.body.querySelector(
          `.bn-block-outer[data-id="${heading.id}"] [data-content-type="heading"]:first-child`,
        );

        if (!elHeading) {
          return;
        }

        const rect = elHeading.getBoundingClientRect();
        const isVisible =
          rect.top + rect.height >= 1 &&
          rect.bottom <=
            (window.innerHeight || document.documentElement.clientHeight);

        if (isVisible) {
          setHeadingIdHighlight(heading.id);
          break;
        }
      }
    };

    let timeout: NodeJS.Timeout;
    const scrollFn = () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        handleScroll();
      }, 300);
    };

    document
      .getElementById(MAIN_LAYOUT_ID)
      ?.addEventListener('scroll', scrollFn);

    handleScroll();

    return () => {
      document
        .getElementById(MAIN_LAYOUT_ID)
        ?.removeEventListener('scroll', scrollFn);
    };
  }, [headings]);

  const onClose = () => {
    setIsOpen(false);
  };

  return (
    <Box
      $width="100%"
      $overflow="hidden"
      $css={css`
        user-select: none;
        padding: ${spacingsTokens['4xs']};
      `}
    >
      <Box
        $margin={{ bottom: spacingsTokens.xs }}
        $direction="row"
        $justify="space-between"
        $align="center"
      >
        <Text $weight="500" $size="sm">
          {t('Summary')}
        </Text>
        <BoxButton
          onClick={onClose}
          $justify="center"
          $align="center"
          aria-label={t('Summary')}
          aria-expanded="true"
          aria-controls="toc-list"
          $css={css`
            transition: none !important;
            transform: rotate(180deg);
            &:focus-visible {
              outline: none;
              box-shadow: 0 0 0 2px ${colorsTokens['brand-400']};
              border-radius: var(--c--globals--spacings--st);
            }
          `}
        >
          <Icon iconName="menu_open" $theme="brand" $variation="tertiary" />
        </BoxButton>
      </Box>
      <Box
        as="ul"
        id="toc-list"
        role="list"
        $gap={spacingsTokens['3xs']}
        $css={css`
          overflow-y: auto;
          list-style: none;
          padding: ${spacingsTokens['3xs']};
          margin: 0;
        `}
      >
        {headings?.map(
          (heading) =>
            heading.contentText && (
              <Box as="li" role="listitem" key={heading.id}>
                <Heading
                  editor={editor}
                  headingId={heading.id}
                  level={heading.props.level}
                  text={heading.contentText}
                  isHighlight={headingIdHighlight === heading.id}
                />
              </Box>
            ),
        )}
      </Box>
    </Box>
  );
};
