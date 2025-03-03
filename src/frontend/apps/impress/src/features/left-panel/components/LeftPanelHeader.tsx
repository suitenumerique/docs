import { Button, ModalSize, useModal } from '@openfun/cunningham-react';
import { t } from 'i18next';
import { useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';

import { Box, Icon, SeparatedSection } from '@/components';
import { useAuth } from '@/features/auth';
import { useCreateDoc } from '@/features/docs/doc-management';
import { DocSearchModal } from '@/features/docs/doc-search';
import { useCmdK } from '@/hook/useCmdK';

import { useLeftPanelStore } from '../stores';

export const LeftPanelHeader = ({ children }: PropsWithChildren) => {
  const router = useRouter();
  const searchModal = useModal();
  const { authenticated } = useAuth();
  useCmdK(searchModal.open);
  const { togglePanel } = useLeftPanelStore();

  const { mutate: createDoc } = useCreateDoc({
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
                aria-label={t('Back to home page')}
                icon={
                  <span aria-hidden="true">
                    <Icon $variation="800" $theme="primary" iconName="house" />
                  </span>
                }
              />
              {authenticated && (
                <Button
                  onClick={searchModal.open}
                  size="medium"
                  color="tertiary-text"
                  aria-label={t('Search')}
                  icon={
                    <span aria-hidden="true">
                      <Icon
                        $variation="800"
                        $theme="primary"
                        iconName="search"
                      />
                    </span>
                  }
                />
              )}
            </Box>
            {authenticated && (
              <Button
                onClick={createNewDoc}
                className="new-doc-button"
                aria-label={t('New document')}
              >
                {t('New doc')}
              </Button>
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
