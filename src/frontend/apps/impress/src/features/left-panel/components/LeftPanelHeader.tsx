import { Button } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { PropsWithChildren, useCallback, useState } from 'react';

import { Box, Icon, SeparatedSection } from '@/components';
import { Doc, useDocStore, useDocUtils } from '@/docs/doc-management';
import { DocSearchModal, DocSearchTarget } from '@/docs/doc-search/';
import { useAuth } from '@/features/auth';
import { useCmdK } from '@/hook/useCmdK';

import { useLeftPanelStore } from '../stores';

import { LeftPanelHeaderButton } from './LeftPanelHeaderButton';

export const LeftPanelHeader = ({ children }: PropsWithChildren) => {
  const { currentDoc } = useDocStore();
  const isDoc = !!currentDoc;
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
    togglePanel();
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
                  onClick={openSearchModal}
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
      {isSearchModalOpen && isDoc && (
        <LeftPanelSearchModalFilter
          onClose={closeSearchModal}
          isOpen={isSearchModalOpen}
          doc={currentDoc}
        />
      )}
      {isSearchModalOpen && !isDoc && (
        <DocSearchModal onClose={closeSearchModal} isOpen={isSearchModalOpen} />
      )}
    </>
  );
};

interface LeftPanelSearchModalProps {
  doc: Doc;
  isOpen: boolean;
  onClose: () => void;
}

const LeftPanelSearchModalFilter = ({
  doc,
  isOpen,
  onClose,
}: LeftPanelSearchModalProps) => {
  const { hasChildren, isChild } = useDocUtils(doc);
  const isWithChildren = isChild || hasChildren;

  let defaultFilters = DocSearchTarget.ALL;
  if (isWithChildren) {
    defaultFilters = DocSearchTarget.CURRENT;
  }

  return (
    <DocSearchModal
      onClose={onClose}
      isOpen={isOpen}
      showFilters={true}
      defaultFilters={{ target: defaultFilters }}
    />
  );
};
