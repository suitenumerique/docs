import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useEditorStore, useHeadingStore } from '@/features/docs/doc-editor';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';

import { Heading } from './Heading';

export const TableContent = () => {
  const { headings } = useHeadingStore();
  const { editor } = useEditorStore();
  const { spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();

  const [headingIdHighlight, setHeadingIdHighlight] = useState<string>();

  const { t } = useTranslation();
  const [isHover, setIsHover] = useState(false);

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

    document.getElementById(MAIN_LAYOUT_ID)?.addEventListener('scroll', () => {
      setTimeout(() => {
        handleScroll();
      }, 300);
    });

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [headings, setHeadingIdHighlight]);

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
            $gap={spacing['3xs']}
            $css={css`
              overflow-y: auto;
            `}
          >
            {headings?.map(
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
