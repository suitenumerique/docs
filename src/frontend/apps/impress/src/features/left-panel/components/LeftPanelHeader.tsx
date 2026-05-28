import { Button } from '@gouvfr-lasuite/cunningham-react';
import { t } from 'i18next';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { PropsWithChildren, useCallback, useState } from 'react';

import HomeSVG from '@/assets/icons/ui-kit/house-rounded.svg';
import SearchSVG from '@/assets/icons/ui-kit/zoom-rounded.svg';
import { Box, SeparatedSection } from '@/components';
import { useDocStore } from '@/docs/doc-management';
import { useAuth } from '@/features/auth';
import { useCmdK } from '@/hooks/useCmdK';

import { useLeftPanelStore } from '../stores';

import { LeftPanelHeaderNewDoc } from './LeftPanelHeaderNewDoc';

const DocSearchModal = dynamic(
  () =>
    import('@/docs/doc-search/components/DocSearchModal').then((mod) => ({
      default: mod.DocSearchModal,
    })),
  { ssr: false },
);

export const LeftPanelHeader = ({ children }: PropsWithChildren) => {
  const { currentDoc } = useDocStore();
  const router = useRouter();
  const { authenticated } = useAuth();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const openSearchModal = useCallback(() => {
    const isEditorToolbarOpen =
      document.getElementsByClassName('bn-formatting-toolbar').length > 0;
    if (isEditorToolbarOpen) {
      return;
    }

    setIsSearchModalOpen(true);
  }, []);

  const closeSearchModal = useCallback(() => {
    setIsSearchModalOpen(false);
  }, []);

  useCmdK(openSearchModal);
  const { togglePanel } = useLeftPanelStore();

  const goToHome = () => {
    void router.push('/');
    togglePanel({ type: 'mobile' });
  };

  return (
    <>
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
            {(router.pathname !== '/' || authenticated) && (
              <Box $direction="row" $gap="2px">
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
                {authenticated && (
                  <Button
                    data-testid="search-docs-button"
                    onClick={openSearchModal}
                    size="medium"
                    color="brand"
                    variant="tertiary"
                    aria-label={t('Search docs')}
                    icon={
                      <SearchSVG aria-hidden="true" width={24} height={24} />
                    }
                  />
                )}
              </Box>
            )}
          </Box>
        </SeparatedSection>
        {children}
      </Box>
      {isSearchModalOpen && (
        <DocSearchModal
          onClose={closeSearchModal}
          isOpen={isSearchModalOpen}
          doc={currentDoc}
        />
      )}
    </>
  );
};
