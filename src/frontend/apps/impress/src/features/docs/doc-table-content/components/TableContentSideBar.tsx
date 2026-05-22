import { Button, ButtonElement } from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import TableContentIcon from '@/assets/icons/ui-kit/bulleted-list.svg';
import { Box, ButtonCloseModal, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useEditorStore } from '@/docs/doc-editor/stores/useEditorStore';
import { useHeadingStore } from '@/docs/doc-editor/stores/useHeadingStore';
import { useRightPanelStore } from '@/features/right-panel/stores/useRightPanelStore';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { useFocusStore } from '@/stores/useFocusStore';

import { Heading } from './Heading';

interface TableContentSideBarProps {
  onClose: () => void;
}

export const TableContentSideBar = ({ onClose }: TableContentSideBarProps) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { headings } = useHeadingStore();
  const { editor } = useEditorStore();
  const [headingIdHighlight, setHeadingIdHighlight] = useState<string>();

  useEffect(() => {
    const handleScroll = () => {
      if (!headings) {
        return;
      }

      let activeHeadingId: string | undefined;

      for (const heading of headings) {
        const elHeading = document.body.querySelector(
          `.bn-block-outer[data-id="${heading.id}"] [data-content-type="heading"]:first-child`,
        );

        if (!elHeading) {
          continue;
        }

        const rect = elHeading.getBoundingClientRect();

        if (rect.top > 0) {
          activeHeadingId = heading.id;
          break;
        }
      }

      // If no heading has passed the top yet, fall back to the first heading
      if (!activeHeadingId && headings.length > 0) {
        activeHeadingId = headings[0].id;
      }

      setHeadingIdHighlight(activeHeadingId);
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
      if (timeout) {
        clearTimeout(timeout);
      }
      document
        .getElementById(MAIN_LAYOUT_ID)
        ?.removeEventListener('scroll', scrollFn);
    };
  }, [headings]);

  return (
    <Box $height="inherit">
      <Box
        $padding={{ vertical: 'base', horizontal: 'sm' }}
        $css={css`
          border-bottom: 1px solid
            var(--c--contextuals--border--surface--primary);
        `}
      >
        <Box $direction="row" $align="center" $justify="space-between">
          <Text as="h2" $weight="bold" $size="16px" $margin="0">
            {t('Table of Contents')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the table of contents sidebar')}
            onClick={onClose}
          />
        </Box>
      </Box>
      {editor && headings && headings.length > 0 && (
        <Box
          as="ul"
          role="list"
          $gap={spacingsTokens['3xs']}
          $padding={{
            vertical: 'base',
            horizontal: 'sm',
          }}
          $css={css`
            overflow-y: auto;
            list-style: none;
            margin: 0;
          `}
        >
          {headings.map(
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
      )}
    </Box>
  );
};

export const TableContentSideBarButton = () => {
  const { t } = useTranslation();
  const { isPanelOpen, activePanel, setActivePanel, setIsPanelOpen } =
    useRightPanelStore();
  const buttonRef = useRef<ButtonElement>(null);
  const { addLastFocus } = useFocusStore();

  const isActive = isPanelOpen && activePanel === 'tableContent';
  const ariaLabel = isActive
    ? t('Hide the table of contents sidebar')
    : t('Show the table of contents sidebar');

  return (
    <Button
      ref={buttonRef}
      size="small"
      onClick={() => {
        if (isActive) {
          setIsPanelOpen(false);
        } else {
          setActivePanel('tableContent');
          addLastFocus(buttonRef.current);
        }
      }}
      aria-label={ariaLabel}
      aria-expanded={isActive}
      color="neutral"
      variant={isActive ? 'secondary' : 'tertiary'}
      icon={<TableContentIcon width={24} height={24} aria-hidden="true" />}
    ></Button>
  );
};
