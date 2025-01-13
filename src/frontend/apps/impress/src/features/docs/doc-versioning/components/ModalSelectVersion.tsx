import { Button, Modal, ModalSize, useModal } from '@openfun/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { DocEditor } from '@/features/docs/doc-editor';
import { Doc } from '@/features/docs/doc-management';

import { Versions } from '../types';

import { ModalConfirmationVersion } from './ModalConfirmationVersion';
import { VersionList } from './VersionList';

const NoPaddingStyle = createGlobalStyle`
  .c__modal__scroller:has(.noPadding) {
    padding: 0 !important;

    .c__modal__close .c__button {
    right: 0;
      top: 7px;
      padding: 1rem 0.5rem;
    }
  }
`;

type ModalSelectVersionProps = {
  doc: Doc;
  onClose: () => void;
};

export const ModalSelectVersion = ({
  onClose,
  doc,
}: ModalSelectVersionProps) => {
  const { t } = useTranslation();
  const [selectedVersionId, setSelectedVersionId] =
    useState<Versions['version_id']>();

  const restoreModal = useModal();
  return (
    <>
      <Modal
        isOpen
        hideCloseButton
        closeOnClickOutside={true}
        size={ModalSize.EXTRA_LARGE}
        onClose={onClose}
      >
        <NoPaddingStyle />
        <Box
          aria-label="version history modal"
          className="noPadding"
          $direction="row"
          $height="100%"
          $maxHeight="calc(100vh - 2em - 12px)"
          $overflow="hidden"
        >
          <Box
            $css={css`
              display: flex;
              flex-direction: row;
              justify-content: center;
              overflow-y: auto;
              flex: 1;
            `}
          >
            <Box
              $width="100%"
              $padding={{ horizontal: 'base', vertical: 'xl' }}
              $align="center"
            >
              {selectedVersionId && (
                <DocEditor doc={doc} versionId={selectedVersionId} />
              )}
              {!selectedVersionId && (
                <Box $align="center" $justify="center" $height="100%">
                  <Text $size="h6" $weight="bold">
                    {t('Select a version on the right to restore')}
                  </Text>
                </Box>
              )}
            </Box>
          </Box>
          <Box
            $direction="column"
            $justify="space-between"
            $width="250px"
            $height="calc(100vh - 2em - 12px)"
            $css={css`
              overflow-y: hidden;
              border-left: 1px solid var(--c--theme--colors--greyscale-200);
            `}
          >
            <Box
              aria-label="version list"
              $css={css`
                overflow-y: auto;
                flex: 1;
              `}
            >
              <Box
                $width="100%"
                $justify="space-between"
                $direction="row"
                $align="center"
                $css={css`
                  border-bottom: 1px solid
                    var(--c--theme--colors--greyscale-200);
                `}
                $padding="sm"
              >
                <Text $size="h6" $variation="1000" $weight="bold">
                  {t('History')}
                </Text>
                <Button
                  onClick={onClose}
                  size="nano"
                  color="primary-text"
                  icon={<Icon iconName="close" />}
                />
              </Box>

              <VersionList
                doc={doc}
                onSelectVersion={setSelectedVersionId}
                selectedVersionId={selectedVersionId}
              />
            </Box>
            <Box
              $padding="xs"
              $css={css`
                border-top: 1px solid var(--c--theme--colors--greyscale-200);
              `}
            >
              <Button
                fullWidth
                disabled={!selectedVersionId}
                onClick={restoreModal.open}
                color="primary"
              >
                {t('Restore')}
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
      {restoreModal.isOpen && selectedVersionId && (
        <ModalConfirmationVersion
          onClose={() => {
            restoreModal.close();
            onClose();
            setSelectedVersionId(undefined);
          }}
          docId={doc.id}
          versionId={selectedVersionId}
        />
      )}
    </>
  );
};
