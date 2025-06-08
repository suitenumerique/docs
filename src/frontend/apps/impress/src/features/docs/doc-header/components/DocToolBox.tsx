import { Button, useModal } from '@openfun/cunningham-react';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc } from '@/docs/doc-management';
import { KEY_LIST_DOC_VERSIONS } from '@/docs/doc-versioning';
import { useResponsiveStore } from '@/stores';

interface DocToolBoxProps {
  doc: Doc;
}

const DocToolBoxLicence = dynamic(() =>
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT === 'false'
    ? import('./DocToolBoxLicenceAGPL').then((mod) => mod.DocToolBoxLicenceAGPL)
    : import('./DocToolBoxLicenceMIT').then((mod) => mod.DocToolBoxLicenceMIT),
);

export const DocToolBox = ({ doc }: DocToolBoxProps) => {
  const { t } = useTranslation();
  const hasAccesses = doc.nb_accesses_direct > 1 && doc.abilities.accesses_view;
  const queryClient = useQueryClient();

  const { spacingsTokens } = useCunninghamTheme();

  const modalHistory = useModal();
  const modalShare = useModal();

  const { isSmallMobile } = useResponsiveStore();

  useEffect(() => {
    if (modalHistory.isOpen) {
      return;
    }

    void queryClient.resetQueries({
      queryKey: [KEY_LIST_DOC_VERSIONS],
    });
  }, [modalHistory.isOpen, queryClient]);

  return (
    <Box
      $margin={{ left: 'auto' }}
      $direction="row"
      $align="center"
      $gap="0.5rem 1.5rem"
      $wrap={isSmallMobile ? 'wrap' : 'nowrap'}
      className="--docs--doc-toolbox"
    >
      <Box
        $direction="row"
        $align="center"
        $margin={{ left: 'auto' }}
        $gap={spacingsTokens['2xs']}
      >
        {!isSmallMobile && (
          <>
            {!hasAccesses && (
              <Button
                color="tertiary-text"
                onClick={() => {
                  modalShare.open();
                }}
                size={isSmallMobile ? 'small' : 'medium'}
              >
                {t('Share')}
              </Button>
            )}
            {hasAccesses && (
              <Box
                $css={css`
                  .c__button--medium {
                    height: 32px;
                    padding: 10px var(--c--theme--spacings--xs);
                    gap: 7px;
                  }
                `}
              >
                <Button
                  color="tertiary"
                  aria-label="Share button"
                  icon={
                    <Icon iconName="group" $theme="primary" $variation="800" />
                  }
                  onClick={() => {
                    modalShare.open();
                  }}
                  size={isSmallMobile ? 'small' : 'medium'}
                >
                  {doc.nb_accesses_direct}
                </Button>
              </Box>
            )}
          </>
        )}

        <DocToolBoxLicence
          doc={doc}
          modalHistory={modalHistory}
          modalShare={modalShare}
        />
      </Box>
    </Box>
  );
};
