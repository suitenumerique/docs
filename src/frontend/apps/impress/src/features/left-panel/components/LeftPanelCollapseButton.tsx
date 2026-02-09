import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { CLASS_DOC_TITLE } from '@/docs/doc-header/components/DocTitle';
import { getEmojiAndTitle, useDocStore, useTrans } from '@/docs/doc-management';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';

import LeftPanelIcon from '../assets/left-panel.svg';
import { useLeftPanelStore } from '../stores';

export const LeftPanelCollapseButton = () => {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const { isPanelOpen, togglePanel } = useLeftPanelStore();
  const { currentDoc } = useDocStore();
  const [isDocTitleVisible, setIsDocTitleVisible] = useState(true);

  useEffect(() => {
    const mainContent = document.getElementById(MAIN_LAYOUT_ID);
    const docTitleEl = document.querySelector(`.${CLASS_DOC_TITLE}`);

    if (!mainContent || !docTitleEl) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsDocTitleVisible(entry.isIntersecting);
      },
      {
        root: mainContent,
        threshold: 0.05,
      },
    );

    observer.observe(docTitleEl);

    return () => {
      observer.disconnect();
      setIsDocTitleVisible(true);
    };
  }, [currentDoc?.id]);

  const { untitledDocument } = useTrans();

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(
    currentDoc?.title ?? '',
  );
  const docTitle = titleWithoutEmoji || untitledDocument;
  const buttonTitle = emoji ? `${emoji} ${docTitle}` : docTitle;
  const shouldShowButtonTitle = !isPanelOpen && !isDocTitleVisible;
  const ariaLabel = isPanelOpen
    ? t('Hide the side panel for {{title}}', { title: docTitle })
    : t('Show the side panel for {{title}}', { title: docTitle });

  return (
    <Box
      $css={css`
        display: inline-flex;
        padding: var(--c--globals--spacings--xxxs);
        align-items: center;
        gap: var(--c--globals--spacings--xxxs);
        border-radius: var(--c--globals--spacings--xs);
        border: 1px solid var(--c--contextuals--border--surface--primary);
        background: var(--c--contextuals--background--surface--primary);
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
      `}
    >
      <Button
        size="small"
        onClick={() => togglePanel()}
        aria-label={ariaLabel}
        aria-expanded={isPanelOpen}
        color="neutral"
        variant="tertiary"
        icon={<LeftPanelIcon width={24} height={24} aria-hidden="true" />}
        data-testid="floating-bar-toggle-left-panel"
      >
        {shouldShowButtonTitle ? (
          <Text $size="sm" $weight={700} $color={colorsTokens['gray-1000']}>
            {buttonTitle}
          </Text>
        ) : undefined}
      </Button>
    </Box>
  );
};
