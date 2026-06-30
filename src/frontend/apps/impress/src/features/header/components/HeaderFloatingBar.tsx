import Image from 'next/image';
import { useTranslation } from 'react-i18next';

import { CardFloatingBar, FloatingBar } from '@/components/FloatingBar';
import { DocSearchButtonModal } from '@/features/docs/doc-search/components/DocSearchButtonModal';
import { LeftPanelCollapseButton } from '@/features/left-panel/components/LeftPanelCollapseButton';
import { useLeftPanelStore } from '@/features/left-panel/stores/useLeftPanelStore';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import DocsLoaderGif from '../assets/DocsLoader.gif';

export const HeaderFloatingBar = () => {
  const { isMobile, isTablet } = useResponsiveStore();
  const { t } = useTranslation();
  const { isPanelOpen } = useLeftPanelStore();

  return (
    <FloatingBar>
      {isTablet && (
        <LeftPanelCollapseButton ariaLabel={t('Toggle left panel')} />
      )}
      {(isTablet && !isPanelOpen) || isMobile ? (
        <>
          <Image
            src={DocsLoaderGif.src}
            alt=""
            width={40}
            height={40}
            style={{ width: 40, height: 'auto' }}
          />
          <CardFloatingBar>
            <DocSearchButtonModal size="small" color="neutral" />
          </CardFloatingBar>
        </>
      ) : null}
    </FloatingBar>
  );
};
