import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Text } from '@/components';
import { useEditorStore, useHeadingStore } from '@/features/docs/doc-editor';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { useResponsiveStore } from '@/stores';

import { Heading } from './Heading';

export const TableContent = () => {
  const { headings } = useHeadingStore();
  const { editor } = useEditorStore();
  const { isMobile } = useResponsiveStore();
  const { t } = useTranslation();
  const [headingIdHighlight, setHeadingIdHighlight] = useState<string>();

  // To highlight the first heading in the viewport
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
    <Box $padding={{ all: 'small', right: 'none' }} $maxHeight="95%">
      <Box $overflow="auto" $padding={{ left: '2px' }}>
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
      <Box
        $height="1px"
        $width="auto"
        $background="#e5e5e5"
        $margin={{ vertical: 'small' }}
        $css="flex: none;"
      />
      <BoxButton
        onClick={() => {
          // With mobile the focus open the keyboard and the scroll is not working
          if (!isMobile) {
            editor.focus();
          }

          document.querySelector(`.bn-editor`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }}
        $align="start"
      >
        <Text $theme="primary" $padding={{ vertical: 'xtiny' }}>
          {t('Back to top')}
        </Text>
      </BoxButton>
      <BoxButton
        onClick={() => {
          // With mobile the focus open the keyboard and the scroll is not working
          if (!isMobile) {
            editor.focus();
          }

          document
            .querySelector(
              `.bn-editor > .bn-block-group > .bn-block-outer:last-child`,
            )
            ?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
        }}
        $align="start"
      >
        <Text $theme="primary" $padding={{ vertical: 'xtiny' }}>
          {t('Go to bottom')}
        </Text>
      </BoxButton>
    </Box>
  );
};
