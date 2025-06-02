import { Button, FileUploader } from '@openfun/cunningham-react';
import { t } from 'i18next';
import { useRouter } from 'next/navigation';
import { PropsWithChildren, useCallback, useMemo, useState } from 'react';

import { Box, Icon, SeparatedSection } from '@/components';
import { useCreateDoc } from '@/docs/doc-management';
import { DocSearchModal } from '@/docs/doc-search';
import { useAuth } from '@/features/auth';
import { useImportDoc } from '@/features/docs/doc-management/api/useImportDoc';
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
      console.log(doc)

      debugger;

      router.push(`/docs/${doc.id}`);
      togglePanel();
    },
  });

  const { mutate: importDoc, status: importDocStatus } = useImportDoc({
    onSuccess: (doc) => {
      router.push(`/docs/${doc.id}`);
      togglePanel();
    },
  });

  const uploadDocImportStatus: undefined | 'uploading' | 'error' | 'success' =
    useMemo(() => {
      if (importDocStatus === 'idle') {
        return undefined;
      }

      if (importDocStatus === 'pending') {
        return 'uploading';
      }

      return importDocStatus;
    }, [importDocStatus]);

  const goToHome = () => {
    router.push('/');
    togglePanel();
  };

  const createNewDoc = () => {
    createDoc();
  };

  type FileEvent = { target: { value: File[] } };

  const uploadChanged = (event: FileEvent) => {
    const file = event.target.value[0];

    if (!file) {
      return;
    }

    console.log('file', file);

    importDoc(file);
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
              <Button onClick={createNewDoc} disabled={isCreatingDoc}>
                {t('New doc')}
              </Button>
            )}
          </Box>
        </SeparatedSection>
        {authenticated && (
          <SeparatedSection>
            <Box
              $padding={{ horizontal: 'sm' }}
              $width="100%"
              $direction="row"
              $justify="space-between"
              $align="center"
            >
              <FileUploader
                width="100%"
                text="Import an existing Microsoft Word file as a document."
                multiple={false}
                onFilesChange={uploadChanged}
                state={uploadDocImportStatus}
              />
            </Box>
          </SeparatedSection>
        )}
        {children}
      </Box>
      {isSearchModalOpen && (
        <DocSearchModal onClose={closeSearchModal} isOpen={isSearchModalOpen} />
      )}
    </>
  );
};
