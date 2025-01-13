import { Button } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, StyledLink } from '@/components';
import { useCreateDoc, useTrans } from '@/features/docs/doc-management/';
import { useResponsiveStore } from '@/stores';

import { DocsGrid } from './DocsGrid';

export const DocsGridContainer = () => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const { push } = useRouter();
  const { isMobile } = useResponsiveStore();

  const { mutate: createDoc } = useCreateDoc({
    onSuccess: (doc) => {
      void push(`/docs/${doc.id}`);
    },
  });

  const handleCreateDoc = () => {
    createDoc({ title: untitledDocument });
  };

  return (
    <Box $overflow="auto">
      <Box
        $direction="row"
        $align="flex-end"
        $justify="flex-end"
        $gap="10px"
        $margin={isMobile ? 'small' : 'big'}
      >
        <StyledLink href="/import">
          <Button color="secondary">
            {t('Import documents')}
          </Button>
        </StyledLink>
        <Button onClick={handleCreateDoc}>{t('Create a new document')}</Button>
      </Box>
      <DocsGrid />
    </Box>
  );
};
