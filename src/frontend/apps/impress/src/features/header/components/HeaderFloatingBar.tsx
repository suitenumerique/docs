import { useTranslation } from 'react-i18next';

import { FadeComponent } from '@/components/Effect';
import { CardFloatingBar, FloatingBar } from '@/components/FloatingBar';
import { DocSearchButtonModal } from '@/features/docs/doc-search/components/DocSearchButtonModal';
import { LeftPanelCollapseButton } from '@/features/left-panel/components/LeftPanelCollapseButton';
import { useLeftPanelStore } from '@/features/left-panel/stores/useLeftPanelStore';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { HeaderIcon } from './HeaderIcon';

export const HeaderFloatingBar = () => {
  const { isMobile, isTablet } = useResponsiveStore();
  const { t } = useTranslation();
  const { isPanelOpen } = useLeftPanelStore();

  const isVisible = (isTablet && !isPanelOpen) || isMobile;

  return (
    <FloatingBar $align="center">
      {isTablet && (
        <LeftPanelCollapseButton ariaLabel={t('Toggle left panel')} />
      )}
      <FadeComponent isVisible={isVisible}>
        <HeaderIcon />
      </FadeComponent>
      <FadeComponent isVisible={isVisible}>
        <CardFloatingBar>
          <DocSearchButtonModal size="small" color="neutral" />
        </CardFloatingBar>
      </FadeComponent>
    </FloatingBar>
  );
};
