import { Button } from '@gouvfr-lasuite/cunningham-react';
import { t } from 'i18next';
import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';

import HomeSVG from '@/assets/icons/ui-kit/house-rounded.svg';
import { Box, SeparatedSection } from '@/components';
import { useAuth } from '@/features/auth';
import { DocSearchButtonModal } from '@/features/docs/doc-search/components/DocSearchButtonModal';

import { useLeftPanelStore } from '../stores';

import { LeftPanelHeaderNewDoc } from './LeftPanelHeaderNewDoc';

export const LeftPanelHeader = ({ children }: PropsWithChildren) => {
  const router = useRouter();
  const { authenticated } = useAuth();

  const { togglePanel } = useLeftPanelStore();

  const goToHome = () => {
    void router.push('/');
    togglePanel({ type: 'mobile' });
  };

  return (
    <Box $width="100%" className="--docs--left-panel-header">
      <SeparatedSection>
        <Box
          $padding={{ horizontal: 'sm' }}
          $width="100%"
          $direction="row"
          $justify="space-between"
          $align="center"
        >
          {authenticated && <LeftPanelHeaderNewDoc />}
          <Box $direction="row" $gap="2px" $margin={{ left: 'auto' }}>
            {router.pathname !== '/' && (
              <Button
                data-testid="home-button"
                onClick={goToHome}
                aria-label={t('Back to homepage')}
                size="medium"
                color="brand"
                variant="tertiary"
                icon={<HomeSVG aria-hidden="true" width={24} height={24} />}
              />
            )}
            <DocSearchButtonModal />
          </Box>
        </Box>
      </SeparatedSection>
      {children}
    </Box>
  );
};
