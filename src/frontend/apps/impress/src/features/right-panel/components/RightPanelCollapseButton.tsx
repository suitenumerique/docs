import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import CommentsIcon from '@/assets/icons/ui-kit/bubble-text.svg';
import { Card } from '@/components';

import { useRightPanelStore } from './useRightPanelStore';

export const RightPanelCollapseButton = () => {
  const { t } = useTranslation();
  const { isPanelOpen, togglePanel } = useRightPanelStore();

  const ariaLabel = isPanelOpen
    ? t('Hide the right side panel')
    : t('Show the right side panel');

  return (
    <Card
      className="--docs--right-panel-collapse-button"
      $direction="row"
      $css={css`
        padding: var(--c--globals--spacings--xxxs);
        align-items: center;
        gap: var(--c--globals--spacings--xxxs);
        border-radius: var(--c--globals--spacings--xs);
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
      `}
    >
      <Button
        size="small"
        onClick={togglePanel}
        aria-label={ariaLabel}
        aria-expanded={isPanelOpen}
        color="neutral"
        variant={isPanelOpen ? 'secondary' : 'tertiary'}
        icon={<CommentsIcon width={24} height={24} aria-hidden="true" />}
        data-testid="floating-bar-toggle-right-panel"
      ></Button>
    </Card>
  );
};
