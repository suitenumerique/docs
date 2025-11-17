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
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();

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
      as="nav"
      id="summaryContainer"
      $width={!isHover ? '40px' : '200px'}
      $height={!isHover ? '40px' : 'auto'}
      $maxHeight="calc(50vh - 60px)"
      $zIndex={1000}
      $align="center"
      $padding={isHover ? 'xs' : '0'}
      $justify="center"
      $position="sticky"
      aria-label={t('Summary')}
      $css={css`
        top: 0;
        border: 1px solid ${colorsTokens['greyscale-300']};
        overflow: hidden;
        border-radius: ${spacingsTokens['3xs']};
        background: ${colorsTokens['greyscale-000']};
        ${isHover &&
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
      {!isHover && (
        <BoxButton
          onClick={onOpen}
          $width="100%"
          $height="100%"
          $justify="center"
          $align="center"
          aria-label={t('Summary')}
          aria-expanded={isHover}
          aria-controls="toc-list"
          $css={css`
            &:hover {
              background: ${colorsTokens['primary-100']};
            }
            &:focus-visible {
              outline: none;
              box-shadow: 0 0 0 4px ${colorsTokens['primary-400']};
              background: ${colorsTokens['primary-100']};
              width: 90%;
              height: 90%;
            }
          `}
        >
          <Icon
            iconName="list"
            $theme="primary"
            $variation="800"
            variant="symbols-outlined"
          />
        </BoxButton>
      )}
      {isHover && (
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
            <Text $weight="500" $size="sm" $variation="800" $theme="primary">
              {t('Summary')}
            </Text>
            <BoxButton
              onClick={onClose}
              $justify="center"
              $align="center"
              aria-label={t('Summary')}
              aria-expanded={isHover}
              aria-controls="toc-list"
              $css={css`
                transition: none !important;
                transform: rotate(180deg);
                &:focus-visible {
                  outline: none;
                  box-shadow: 0 0 0 2px ${colorsTokens['primary-400']};
                  border-radius: 4px;
                }
              `}
            >
              <Icon iconName="menu_open" $theme="primary" $variation="800" />
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
      )}
    </Box>
  );
};
