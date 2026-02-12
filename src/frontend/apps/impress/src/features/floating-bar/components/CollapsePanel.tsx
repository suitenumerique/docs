import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { getEmojiAndTitle, useDocStore, useTrans } from '@/docs/doc-management';
import { useFloatingBarStore } from '@/features/floating-bar';
import { useLeftPanelStore } from '@/features/left-panel';

import LeftPanelIcon from '../assets/left-panel.svg';

export const CollapsePanel = () => {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const { isPanelOpen, togglePanel } = useLeftPanelStore();
  const { isDocHeaderVisible } = useFloatingBarStore();
  const { currentDoc } = useDocStore();
  const { untitledDocument } = useTrans();

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(
    currentDoc?.title ?? '',
  );
  const docTitle = titleWithoutEmoji || untitledDocument;
  const buttonTitle = emoji ? `${emoji} ${docTitle}` : docTitle;
  const shouldShowButtonTitle = !isPanelOpen && !isDocHeaderVisible;
  const ariaLabel = t(
    isPanelOpen
      ? 'Hide the side panel for {{title}}'
      : 'Show the side panel for {{title}}',
    { title: docTitle },
  );

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
