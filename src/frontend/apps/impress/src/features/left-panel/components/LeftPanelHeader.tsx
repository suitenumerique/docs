import { Button, ModalSize, useModal } from '@openfun/cunningham-react';
import { t } from 'i18next';
import { useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';

import { Box, Icon, SeparatedSection } from '@/components';
import { useTreeStore } from '@/components/common/tree/treeStore';
import { useAuth } from '@/features/auth';
import { useCreateDoc, useDocStore } from '@/features/docs/doc-management';
import { DocSearchModal } from '@/features/docs/doc-search';
import { useCreateChildrenDoc } from '@/features/docs/doc-tree/api/useCreateChildren';

import { useLeftPanelStore } from '../stores';

type Props = PropsWithChildren<{}>;

export const LeftPanelHeader = ({ children }: Props) => {
  const router = useRouter();
  const { currentDoc } = useDocStore();
  const treeStore = useTreeStore();

  const searchModal = useModal();
  const { authenticated } = useAuth();
  const { togglePanel } = useLeftPanelStore();

  const { mutate: createDoc } = useCreateDoc({
    onSuccess: (doc) => {
      router.push(`/docs/${doc.id}`);
      treeStore.setSelectedNode(doc);
      togglePanel();
    },
  });

  const { mutate: createChildrenDoc } = useCreateChildrenDoc({
    onSuccess: (doc) => {
      treeStore.addRootNode(doc);
      treeStore.setSelectedNode(doc);
      router.push(`/docs/${doc.id}`);
      togglePanel();
    },
  });

  const goToHome = () => {
    router.push('/');
    togglePanel();
  };

  const createNewDoc = () => {
    if (currentDoc) {
      createChildrenDoc({
        title: t('Untitled page'),
        parentId: currentDoc.id,
      });
    } else {
      createDoc();
    }
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
            {authenticated && (
              <Button onClick={createNewDoc}>{t('New doc')}</Button>
            )}
          </Box>
        </SeparatedSection>
        {children}
      </Box>
      {searchModal.isOpen && (
        <DocSearchModal {...searchModal} size={ModalSize.LARGE} />
      )}
    </>
  );
};
