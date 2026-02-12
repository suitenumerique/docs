import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  LinkReach,
  getDocLinkReach,
  useIsCollaborativeEditable,
} from '@/docs/doc-management';
import { useFloatingBarStore } from '@/features/floating-bar';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
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
}

export const DocHeader = ({ doc }: DocHeaderProps) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();
  const { setIsDocHeaderVisible } = useFloatingBarStore();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const docIsPublic = getDocLinkReach(doc) === LinkReach.PUBLIC;
  const docIsAuth = getDocLinkReach(doc) === LinkReach.AUTHENTICATED;
  const isDeletedDoc = !!doc.deleted_at;

  useEffect(() => {
    const mainContent = document.getElementById(MAIN_LAYOUT_ID);
    const header = headerRef.current;

    if (!mainContent || !header) {
      setIsDocHeaderVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsDocHeaderVisible(entry.isIntersecting);
      },
      {
        root: mainContent,
        threshold: 0.05,
      },
    );

    observer.observe(header);

    return () => {
      observer.disconnect();
      setIsDocHeaderVisible(true);
    };
  }, [doc.id, setIsDocHeaderVisible]);

  return (
    <>
      <Box
        ref={headerRef}
        $width="100%"
        $padding={{ top: isDesktop ? '0' : 'md' }}
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
            {!isDeletedDoc && <DocToolBox doc={doc} />}
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
