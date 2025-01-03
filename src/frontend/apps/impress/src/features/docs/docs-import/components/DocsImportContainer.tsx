import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { useResponsiveStore } from '@/stores';
import { DocsImport } from './DocsImport';

export const DocsImportContainer = () => {
  const { t } = useTranslation();
  const { isMobile } = useResponsiveStore();

  return (
    <Box $overflow="auto" $padding={isMobile ? 'small' : 'big'}>
      <DocsImport />
    </Box>
  );
};
