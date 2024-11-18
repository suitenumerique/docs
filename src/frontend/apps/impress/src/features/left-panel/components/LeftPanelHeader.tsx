import { Button } from '@openfun/cunningham-react';
import { t } from 'i18next';
import { useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';

import { Box, Icon, SeparatedSection } from '@/components';
import { useCreateDoc } from '@/features/docs';

import { useLeftPanelStore } from '../stores';

export const LeftPanelHeader = ({ children }: PropsWithChildren) => {
  const router = useRouter();
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
    createDoc({ title: t('Untitled document') });
  };

  return (
    <Box $width="100%">
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
              color="primary-text"
              icon={<Icon iconName="house" />}
            />
          </Box>
          <Button onClick={createNewDoc}>{t('New doc')}</Button>
        </Box>
      </SeparatedSection>
      {children}
    </Box>
  );
};
