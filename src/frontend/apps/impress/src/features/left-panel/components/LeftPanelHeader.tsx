import { Button } from '@openfun/cunningham-react';
import { t } from 'i18next';
import { useRouter } from 'next/navigation';
import { PropsWithChildren, useCallback, useState } from 'react';

import { Box, DropdownMenu, Icon, SeparatedSection } from '@/components';
import { useCreateDoc } from '@/docs/doc-management';
import { DocSearchModal } from '@/docs/doc-search';
import { useAuth } from '@/features/auth';
import { useCmdK } from '@/hook/useCmdK';

import { useLeftPanelStore } from '../stores';

export const LeftPanelHeader = ({ children }: PropsWithChildren) => {
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

  const { mutate: createDoc, isPending: isCreatingDoc } = useCreateDoc({
    onSuccess: (doc) => {
      router.push(`/docs/${doc.id}`);
      togglePanel();
    },
  });

  const goToHome = () => {
    router.push('/');
    togglePanel();
  };

  const createNewDoc = () => {
    createDoc();
  };

  const handleImportFilesystem = () => {
    // TODO: Implement filesystem import
  };

  const handleImportNotion = () => {
    const baseApiUrl = process.env.NEXT_PUBLIC_API_ORIGIN;
    const notionAuthUrl = `${baseApiUrl}/api/v1.0/notion_import/redirect`;
    window.location.href = notionAuthUrl;
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
            {authenticated && (
              <DropdownMenu
                showArrow
                disabled={isCreatingDoc}
                options={[
                  { label: t('From your computer'), disabled: true },
                  {
                    label: t('Open file...'),
                    callback: handleImportFilesystem,
                    padding: { vertical: 'xs', horizontal: 'md' },
                  },
                  {
                    label: t('Import files...'),
                    padding: { vertical: 'xs', horizontal: 'md' },
                  },
                  { label: t('From connected apps'), disabled: true },
                  {
                    label: t('Import from Notion'),
                    callback: handleImportNotion,
                    padding: { vertical: 'xs', horizontal: 'md' },
                  },
                ]}
              >
                <Button
                  tabIndex={0}
                  onClick={createNewDoc}
                  disabled={isCreatingDoc}
                >
                  {t('New doc')}
                </Button>
              </DropdownMenu>
            )}
          </Box>
        </SeparatedSection>
        {children}
      </Box>
      {isSearchModalOpen && (
        <DocSearchModal onClose={closeSearchModal} isOpen={isSearchModalOpen} />
      )}
    </>
  );
};
