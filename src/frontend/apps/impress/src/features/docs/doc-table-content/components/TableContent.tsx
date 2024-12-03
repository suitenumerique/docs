import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useEditorStore, useHeadingStore } from '@/features/docs/doc-editor';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';

import { Heading } from './Heading';

export const TableContent = () => {
  const { headings } = useHeadingStore();
  const { editor } = useEditorStore();

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

  if (!editor) {
    return null;
  }

  return (
    <Box
      onMouseEnter={() => {
        setIsHover(true);
        setTimeout(() => {
          const element = document.getElementById(
            `heading-${headingIdHighlight}`,
          );

          element?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'center',
          });
        }, 250); // 300ms is the transition time of the box
      }}
      onMouseLeave={() => {
        setIsHover(false);
      }}
      id="summaryContainer"
      $effect="show"
      $width="40px"
      $height="40px"
      $zIndex={1000}
      $align="center"
      $padding="xs"
      $justify="center"
      $css={css`
        border: 1px solid #ccc;
        overflow: hidden;
        border-radius: var(--c--theme--spacings--3xs);
        background: var(--c--theme--colors--greyscale-000);

        &:hover {
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: flex-start;
          gap: var(--c--theme--spacings--2xs);
          width: 200px;
          height: auto;
          max-height: calc(100vh - 60px - 15vh);
        }
      `}
    >
      {!isHover && (
        <Box $justify="center" $align="center">
          <Icon iconName="list" $theme="primary" $variation="800" />
        </Box>
      )}
      {isHover && (
        <Box $width="100%">
          <Box
            $margin={{ bottom: '20px' }}
            $direction="row"
            $justify="space-between"
            $align="center"
          >
            <Text $weight="bold" $variation="800" $theme="primary">
              {t('Summary')}
            </Text>
            <Icon iconName="list" $theme="primary" $variation="800" />
          </Box>
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
      )}
    </Box>
  );
};
