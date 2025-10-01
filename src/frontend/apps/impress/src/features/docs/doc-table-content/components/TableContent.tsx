import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useEditorStore, useHeadingStore } from '@/docs/doc-editor';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';

import { Heading } from './Heading';

export const TableContent = () => {
  const { headings } = useHeadingStore();
  const { editor } = useEditorStore();
  const { spacingsTokens } = useCunninghamTheme();

  const [headingIdHighlight, setHeadingIdHighlight] = useState<string>();

  const { t } = useTranslation();
  const [isHover, setIsHover] = useState(false);

  // Filter headings to only show h1, h2, h3 (levels 1-3)
  const filteredHeadings = headings?.filter(
    (heading) => heading.props.level >= 1 && heading.props.level <= 3,
  );

  useEffect(() => {
    const handleScroll = () => {
      if (!filteredHeadings) {
        return;
      }

      for (const heading of filteredHeadings) {
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
  }, [filteredHeadings, setHeadingIdHighlight]);

  const onOpen = () => {
    setIsHover(true);
    setTimeout(() => {
      const element = document.getElementById(`heading-${headingIdHighlight}`);

      element?.scrollIntoView({
        behavior: 'instant',
        inline: 'center',
        block: 'center',
      });
    }, 0); // 300ms is the transition time of the box
  };

  const onClose = () => {
    setIsHover(false);
  };

  const shouldHideTableContent =
    !editor ||
    !filteredHeadings ||
    filteredHeadings.length === 0 ||
    (filteredHeadings.length === 1 && !filteredHeadings[0].contentText);

  if (shouldHideTableContent) {
    return null;
  }

  return (
    <Box
      id="summaryContainer"
      $width={!isHover ? '40px' : '200px'}
      $height={!isHover ? '40px' : 'auto'}
      $maxHeight="calc(50vh - 60px)"
      $zIndex={1000}
      $align="center"
      $padding="xs"
      $justify="center"
      $css={css`
        border: 1px solid #ccc;
        overflow: hidden;
        border-radius: var(--c--theme--spacings--3xs);
        background: var(--c--theme--colors--greyscale-000);
        ${isHover &&
        css`
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: flex-start;
          gap: var(--c--theme--spacings--2xs);
        `}
      `}
      className="--docs--table-content"
    >
      {!isHover && (
        <BoxButton onClick={onOpen} $justify="center" $align="center">
          <Icon iconName="list" $theme="primary" $variation="800" />
        </BoxButton>
      )}
      {isHover && (
        <Box
          $width="100%"
          $overflow="hidden"
          $css={css`
            user-select: none;
          `}
        >
          <Box
            $margin={{ bottom: '10px' }}
            $direction="row"
            $justify="space-between"
            $align="center"
          >
            <Text $weight="500" $size="sm" $variation="800" $theme="primary">
              {t('Summary')}
            </Text>
            <BoxButton
              onClick={onClose}
              $justify="center"
              $align="center"
              $css={css`
                transform: rotate(180deg);
              `}
            >
              <Icon iconName="menu_open" $theme="primary" $variation="800" />
            </BoxButton>
          </Box>
          <Box
            $gap={spacingsTokens['3xs']}
            $css={css`
              overflow-y: auto;
            `}
          >
            {filteredHeadings?.map(
              (heading) =>
                heading.contentText && (
                  <Heading
                    editor={editor}
                    headingId={heading.id}
                    level={heading.props.level}
                    text={heading.contentText}
                    key={heading.id}
                    isHighlight={headingIdHighlight === heading.id}
                  />
                ),
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};
