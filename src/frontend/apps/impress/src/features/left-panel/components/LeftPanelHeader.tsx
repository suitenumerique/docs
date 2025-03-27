import { Button, ModalSize, useModal } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';

import { Box, Icon, SeparatedSection } from '@/components';
import { DocSearchModal } from '@/docs/doc-search';
import { useAuth } from '@/features/auth';
import { DocSearchTarget } from '@/features/docs/doc-search/components/DocSearchFilters';
import { useCmdK } from '@/hook/useCmdK';

import { useLeftPanelStore } from '../stores';

import { LeftPanelHeaderButton } from './LeftPanelHeaderButton';

export const LeftPanelHeader = ({ children }: PropsWithChildren) => {
  const router = useRouter();
  const searchModal = useModal();
  const { authenticated } = useAuth();
  const isDoc = router.pathname === '/docs/[id]';

  useCmdK(() => {
    const isEditorToolbarOpen =
      document.getElementsByClassName('bn-formatting-toolbar').length > 0;
    if (isEditorToolbarOpen) {
      return;
    }

    searchModal.open();
  });
  const { togglePanel } = useLeftPanelStore();

  const goToHome = () => {
    void router.push('/');
    togglePanel();
  };

  return (
    <>
      <Box $width="100%" className="panel-header">
        <SeparatedSection>
          <Box
            $padding={{ horizontal: 'sm' }}
            $width="100%"
            $direction="row"
            $justify="space-between"
            $align="center"
          >
            <Box $direction="row" $gap="2px">
              <Button
                onClick={goToHome}
                size="medium"
                color="tertiary-text"
                icon={
                  <Icon $variation="800" $theme="primary" iconName="house" />
                }
              />
              {authenticated && (
                <Button
                  onClick={searchModal.open}
                  size="medium"
                  color="tertiary-text"
                  icon={
                    <Icon $variation="800" $theme="primary" iconName="search" />
                  }
                />
              )}
            </Box>

            {authenticated && <LeftPanelHeaderButton />}
          </Box>
        </SeparatedSection>
        {children}
      </Box>
      {searchModal.isOpen && (
        <DocSearchModal
          {...searchModal}
          size={ModalSize.LARGE}
          showFilters={isDoc}
          defaultFilters={{
            target: isDoc ? DocSearchTarget.CURRENT : undefined,
          }}
        />
      )}
    </>
  );
};
