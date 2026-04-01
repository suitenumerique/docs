import {
  Button,
  Modal,
  ModalSize,
  useModal,
} from '@gouvfr-lasuite/cunningham-react';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, BoxButton, ButtonCloseModal, Text } from '@/components';
import { Doc } from '@/docs/doc-management';

import { VersionSelectMode, Versions } from '../types';

import { DocVersionDiffEditor } from './DocVersionDiffEditor';
import { DocVersionEditor } from './DocVersionEditor';
import { VersionList } from './VersionList';

const ModalConfirmationVersion = dynamic(
  () =>
    import('./ModalConfirmationVersion').then((mod) => ({
      default: mod.ModalConfirmationVersion,
    })),
  { ssr: false },
);

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
  const [mode, setMode] = useState<VersionSelectMode>('view');
  const [selectedVersionId, setSelectedVersionId] =
    useState<Versions['version_id']>();
  const [baseVersionId, setBaseVersionId] =
    useState<Versions['version_id']>();
  const [targetVersionId, setTargetVersionId] =
    useState<Versions['version_id']>();
  const canRestore = doc.abilities.partial_update;
  const restoreModal = useModal();

  const handleSelectVersion = useCallback(
    (versionId: Versions['version_id']) => {
      if (mode === 'view') {
        setSelectedVersionId(versionId);
        return;
      }

      // Compare mode: fill base first, then target
      if (!baseVersionId) {
        setBaseVersionId(versionId);
      } else if (!targetVersionId) {
        if (versionId === baseVersionId) {
          // Deselect base if clicked again
          setBaseVersionId(undefined);
        } else {
          setTargetVersionId(versionId);
        }
      } else {
        // Both selected: clicking again replaces target (or deselects)
        if (versionId === baseVersionId) {
          setBaseVersionId(targetVersionId);
          setTargetVersionId(undefined);
        } else if (versionId === targetVersionId) {
          setTargetVersionId(undefined);
        } else {
          setTargetVersionId(versionId);
        }
      }
    },
    [mode, baseVersionId, targetVersionId],
  );

  const handleModeToggle = useCallback(() => {
    if (mode === 'view') {
      setMode('compare');
      setBaseVersionId(undefined);
      setTargetVersionId(undefined);
    } else {
      setMode('view');
      setBaseVersionId(undefined);
      setTargetVersionId(undefined);
    }
  }, [mode]);

  const showDiff = mode === 'compare' && baseVersionId && targetVersionId;

  return (
    <>
      <Modal
        isOpen
        hideCloseButton
        closeOnClickOutside={true}
        size={ModalSize.EXTRA_LARGE}
        onClose={onClose}
        aria-label={t('Version history')}
      >
        <NoPaddingStyle />
        <Box
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
              {mode === 'view' && selectedVersionId && (
                <DocVersionEditor
                  docId={doc.id}
                  versionId={selectedVersionId}
                />
              )}
              {mode === 'view' && !selectedVersionId && (
                <Box $align="center" $justify="center" $height="100%">
                  <Text $size="h6" $weight="bold">
                    {t('Select a version on the right to restore')}
                  </Text>
                </Box>
              )}
              {mode === 'compare' && showDiff && (
                <DocVersionDiffEditor
                  docId={doc.id}
                  baseVersionId={baseVersionId}
                  targetVersionId={targetVersionId}
                />
              )}
              {mode === 'compare' && !showDiff && (
                <Box $align="center" $justify="center" $height="100%">
                  <Text $size="h6" $weight="bold">
                    {t('Select two versions to compare')}
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
              border-left: 1px solid
                var(--c--contextuals--border--surface--primary);
            `}
          >
            <Box
              aria-label={t('Version list')}
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
                    var(--c--contextuals--border--surface--primary);
                `}
                $padding="sm"
              >
                <Text $size="h6" $weight="bold">
                  {t('History')}
                </Text>
                <ButtonCloseModal
                  aria-label={t('Close the version history modal')}
                  autoFocus
                  onClick={onClose}
                  size="nano"
                />
              </Box>

              <Box
                $padding={{ horizontal: 'xs', vertical: 'xxs' }}
                $css={css`
                  border-bottom: 1px solid
                    var(--c--contextuals--border--surface--primary);
                `}
              >
                <BoxButton
                  aria-pressed={mode === 'compare'}
                  onClick={handleModeToggle}
                  $width="100%"
                  $padding={{ vertical: 'xxs', horizontal: 'xs' }}
                  $css={`
                    background: ${mode === 'compare' ? 'var(--c--contextuals--background--semantic--overlay--primary)' : 'transparent'};
                    border-radius: 4px;
                    &:hover {
                      background: var(--c--contextuals--background--semantic--overlay--primary);
                    }
                  `}
                >
                  <Text $size="xs" $weight="bold" $textAlign="center">
                    {mode === 'view'
                      ? t('Compare versions')
                      : t('Back to history')}
                  </Text>
                </BoxButton>
              </Box>

              <VersionList
                doc={doc}
                onSelectVersion={handleSelectVersion}
                selectedVersionId={selectedVersionId}
                mode={mode}
                baseVersionId={baseVersionId}
                targetVersionId={targetVersionId}
              />
            </Box>
            {canRestore && mode === 'view' && (
              <Box
                $padding="xs"
                $css={css`
                  border-top: 1px solid
                    var(--c--contextuals--border--surface--primary);
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
          }}
          onSuccess={() => {
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
