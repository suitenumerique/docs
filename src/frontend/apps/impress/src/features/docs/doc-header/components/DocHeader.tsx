import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, useIsCollaborativeEditable } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { AlertNetwork } from './AlertNetwork';
import { AlertRestore } from './AlertRestore';
import { DocHeaderInfo } from './DocHeaderInfo';
import { DocTitle } from './DocTitle';
import { DocToolBox } from './DocToolBox';

interface DocHeaderProps {
  doc: Doc;
}

export const DocHeader = ({ doc }: DocHeaderProps) => {
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const isDeletedDoc = !!doc.deleted_at;

  return (
    <>
      <Box
        $width="100%"
        $padding={{ top: isDesktop ? '0' : 'md' }}
        $gap={spacingsTokens['base']}
        aria-label={t('It is the card information about the document.')}
        className="--docs--doc-header"
      >
        {isDeletedDoc && <AlertRestore doc={doc} />}
        {!isEditable && <AlertNetwork />}
        <Box
          $direction="row"
          $align="center"
          $width="100%"
          $padding={{ bottom: 'xs' }}
        >
          <Box
            $direction="row"
            $justify="space-between"
            $css="flex:1;"
            $gap="0.5rem 1rem"
            $align="center"
            $maxWidth="100%"
          >
            <Box $gap={spacingsTokens['3xs']} $overflow="auto">
              <DocTitle doc={doc} />
              <Box $direction="row">
                <DocHeaderInfo doc={doc} />
              </Box>
            </Box>
            {!isDeletedDoc && <DocToolBox doc={doc} />}
          </Box>
        </Box>
        <HorizontalSeparator $margin="none" />
      </Box>
    </>
  );
};
