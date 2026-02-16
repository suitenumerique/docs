import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  LinkReach,
  getDocLinkReach,
  useIsCollaborativeEditable,
} from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { AlertNetwork } from './AlertNetwork';
import { AlertPublic } from './AlertPublic';
import { AlertRestore } from './AlertRestore';
import { BoutonShare } from './BoutonShare';
import { DocHeaderInfo } from './DocHeaderInfo';
import { DocTitle } from './DocTitle';
import { DocToolBox } from './DocToolBox';

interface DocHeaderProps {
  doc: Doc;
  encryptionSettings: {
    userId: string;
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
  } | null;
}

export const DocHeader = ({ doc, encryptionSettings }: DocHeaderProps) => {
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const docIsPublic = getDocLinkReach(doc) === LinkReach.PUBLIC;
  const docIsAuth = getDocLinkReach(doc) === LinkReach.AUTHENTICATED;
  const isDeletedDoc = !!doc.deleted_at;

  return (
    <>
      <Box
        $width="100%"
        $padding={{ top: isDesktop ? '50px' : 'md' }}
        $gap={spacingsTokens['base']}
        aria-label={t('It is the card information about the document.')}
        className="--docs--doc-header"
      >
        {isDeletedDoc && <AlertRestore doc={doc} />}
        {!isEditable && <AlertNetwork />}
        {(docIsPublic || docIsAuth) && (
          <AlertPublic isPublicDoc={docIsPublic} />
        )}
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
            {!isDeletedDoc && (
              <DocToolBox doc={doc} encryptionSettings={encryptionSettings} />
            )}
            {isDeletedDoc && (
              <BoutonShare
                doc={doc}
                open={() => {}}
                displayNbAccess={true}
                isDisabled
              />
            )}
          </Box>
        </Box>
        <HorizontalSeparator $withPadding={false} />
      </Box>
    </>
  );
};
