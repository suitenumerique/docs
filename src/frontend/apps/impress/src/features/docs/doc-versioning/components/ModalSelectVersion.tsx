import {
  Button,
  ButtonElement,
  Modal,
  ModalSize,
  useModal,
} from '@gouvfr-lasuite/cunningham-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, ButtonCloseModal, Text } from '@/components';
import { Doc } from '@/docs/doc-management';
import { useFocusOnMount } from '@/hooks';

import { Versions } from '../types';

import { DocVersionEditor } from './DocVersionEditor';
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
  const closeButtonRef = useRef<ButtonElement>(null);
  const [selectedVersionId, setSelectedVersionId] =
    useState<Versions['version_id']>();
  const canRestore = doc.abilities.partial_update;
  const restoreModal = useModal();

  useFocusOnMount(closeButtonRef);

  return (
    <>
      <Modal
        isOpen
        hideCloseButton
        closeOnClickOutside={true}
        size={ModalSize.EXTRA_LARGE}
        onClose={onClose}
        aria-describedby="modal-select-version-title"
      >
        <NoPaddingStyle />
        <Box
          aria-label="version history modal"
          className="--docs--modal-select-version noPadding"
          $direction="row"
          $height="100%"
          $maxHeight="calc(100vh - 2em - 12px)"
          $overflow="hidden"
        >
          <Text
            as="h1"
            $margin="0"
            id="modal-select-version-title"
            className="sr-only"
          >
            {t('Version history')}
          </Text>
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
                <DocVersionEditor
                  docId={doc.id}
                  versionId={selectedVersionId}
                />
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
              border-left: 1px solid var(--c--globals--colors--gray-200);
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
                  border-bottom: 1px solid var(--c--globals--colors--gray-200);
                `}
                $padding="sm"
              >
                <Text $size="h6" $weight="bold">
                  {t('History')}
                </Text>
                <ButtonCloseModal
                  ref={closeButtonRef}
                  aria-label={t('Close the version history modal')}
                  onClick={onClose}
                  size="nano"
                />
              </Box>

              <VersionList
                doc={doc}
                onSelectVersion={setSelectedVersionId}
                selectedVersionId={selectedVersionId}
              />
            </Box>
            {canRestore && (
              <Box
                $padding="xs"
                $css={css`
                  border-top: 1px solid var(--c--globals--colors--gray-200);
                `}
              >
                <Button
                  fullWidth
                  disabled={!selectedVersionId}
                  onClick={restoreModal.open}
                >
                  {t('Restore')}
                </Button>
              </Box>
            )}
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
