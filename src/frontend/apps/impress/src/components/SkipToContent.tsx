import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/Box';
import { useCunninghamTheme } from '@/cunningham';
import { useLeftPanelStore } from '@/features/left-panel/stores/useLeftPanelStore';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { focusMainContentStart } from '@/layouts/utils';
import { useResponsiveStore } from '@/stores';

const LEFT_PANEL_CLOSE_TRANSITION_MS = 200;
const HEADER_ROW_HEIGHT = '68px';
const HEADER_ICON_WIDTH = '32px';
const COLLAPSE_BUTTON_WIDTH = '48px';

export const SkipToContent = () => {
  const { t } = useTranslation();
  const { pathname } = useRouter();
  const { spacingsTokens } = useCunninghamTheme();
  const { isMobile } = useResponsiveStore();
  const { isPanelOpen, closePanel } = useLeftPanelStore();
  const [isVisible, setIsVisible] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    const focusContent = () => {
      const focusTarget = focusMainContentStart();

      if (focusTarget instanceof HTMLElement) {
        focusTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    if (isMobile && isPanelOpen) {
      closePanel();
      window.setTimeout(focusContent, LEFT_PANEL_CLOSE_TRANSITION_MS);
      return;
    }

    focusContent();
  };

  const leftBesideLogo = `calc(${spacingsTokens['sm']} + ${HEADER_ICON_WIDTH} + ${spacingsTokens['4xs']} + 70px + 12px)`;
  const isMobilePanelClosed = isMobile && !isPanelOpen;
  const isDocEditorPage = pathname === '/docs/[id]';

  const left = isMobilePanelClosed
    ? isDocEditorPage
      ? `calc(${spacingsTokens['sm']} + ${COLLAPSE_BUTTON_WIDTH} + ${spacingsTokens['2xs']})`
      : `calc(${spacingsTokens['sm']} + ${HEADER_ICON_WIDTH} + ${spacingsTokens['2xs']})`
    : leftBesideLogo;

  const top = `calc(${HEADER_ROW_HEIGHT} / 2)`;

  return (
    <Box>
      <Button
        href={`#${MAIN_LAYOUT_ID}`}
        color="brand"
        size="small"
        className="--docs--skip-to-content"
        onClick={handleClick}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        style={{
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          position: 'fixed',
          top,
          left,
          transform: 'translateY(-50%)',
          zIndex: 9999,
          whiteSpace: 'nowrap',
        }}
      >
        {t('Go to content')}
      </Button>
    </Box>
  );
};
