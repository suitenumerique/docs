import { Button } from '@gouvfr-lasuite/cunningham-react';

import { Text } from '@/components';
import { FadeComponent } from '@/components/Effect';
import { CardFloatingBar } from '@/components/FloatingBar';
import { useResponsiveStore } from '@/stores';

import LeftPanelIcon from '../assets/left-panel.svg';
import { useLeftPanelStore } from '../stores';

export const LeftPanelCollapseButton = ({
  ariaLabel,
  buttonTitle,
  buttonEmoji,
}: {
  ariaLabel: string;
  buttonTitle?: string;
  buttonEmoji?: string | null;
}) => {
  const { isPanelOpen, togglePanel } = useLeftPanelStore();
  const { isSmallMobile } = useResponsiveStore();

  return (
    <CardFloatingBar className="--docs--left-panel-collapse-button">
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
        {!isSmallMobile && !!buttonTitle && (
          <FadeComponent isVisible={!!buttonTitle}>
            <Text
              $size="sm"
              $weight={700}
              $color="var(--c--globals--colors--gray-1000)"
              title={buttonTitle}
            >
              {buttonEmoji && <span aria-hidden="true">{buttonEmoji} </span>}
              {buttonTitle}
            </Text>
          </FadeComponent>
        )}
      </Button>
    </CardFloatingBar>
  );
};
