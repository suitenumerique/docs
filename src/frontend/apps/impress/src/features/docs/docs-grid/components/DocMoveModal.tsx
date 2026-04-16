import {
  Button,
  Modal,
  ModalSize,
  useModal,
} from '@gouvfr-lasuite/cunningham-react';
import { TreeViewMoveModeEnum } from '@gouvfr-lasuite/ui-kit';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import { Box, ButtonCloseModal, HorizontalSeparator, Text } from '@/components';
import { QuickSearch } from '@/components/quick-search';
import { Doc, useMoveDoc, useTrans } from '@/docs/doc-management';
import { DocSearchContent } from '@/docs/doc-search';
import { useResponsiveStore } from '@/stores';

import { DocsGridItemDate, DocsGridItemTitle } from './DocsGridItem';

const AlertModalRequestAccess = dynamic(
  () =>
    import('@/docs/doc-share/components/AlertModalRequestAccess').then(
      (mod) => ({ default: mod.AlertModalRequestAccess }),
    ),
  { ssr: false },
);

const ModalConfirmationMoveDoc = dynamic(
  () =>
    import('./ModalConfimationMoveDoc').then((mod) => ({
      default: mod.ModalConfirmationMoveDoc,
    })),
  { ssr: false },
);

export const DocMoveModalStyle = createGlobalStyle`
  .c__modal--full .c__modal__scroller {
    height: 100vh;
  }

  .c__modal__scroller:has(.quick-search-container){
    display: flex;
    flex-direction: column;

    .quick-search-container [cmdk-list] {
      overflow-y: auto;
    }

    div.c__modal__title {
      padding: 0;
      margin-bottom: 0;
    }
    .c__modal__footer {
      margin-top: 0rem;
      border-top: 1px solid var(--c--contextuals--border--surface--primary);
    }
    .quick-search-input{
      padding-inline: var(--c--globals--spacings--md);
    }
    .quick-search-container [cmdk-item] {
      border-radius: 4px;
    }
    .quick-search-container [cmdk-item][data-selected='true'] {
      background: var(--c--contextuals--background--semantic--contextual--primary);
    }
  }
`;

type DocMoveModalGlobalProps = {
  doc: Doc;
  isOpen: boolean;
  onClose: () => void;
};

export const DocMoveModal = ({
  doc,
  isOpen,
  onClose,
}: DocMoveModalGlobalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [docSelected, setDocSelected] = useState<Doc>();
  const { untitledDocument } = useTrans();
  const docTitle = doc.title || untitledDocument;
  const docTargetTitle = docSelected?.title || untitledDocument;
  const modalConfirmation = useModal();
  const modalRequest = useModal();
  const { mutate: moveDoc } = useMoveDoc();
  const [search, setSearch] = useState('');
  const { isDesktop, isTablet, isMobile } = useResponsiveStore();
  const isModal = (isDesktop || isTablet) && !isMobile;
  const handleInputSearch = useDebouncedCallback(setSearch, 700);

  const handleSelect = (docSelected: Doc) => {
    setDocSelected(docSelected);
  };

  const handleMoveDoc = () => {
    modalConfirmation.onClose();
    if (!docSelected?.id) {
      return;
    }

    moveDoc({
      sourceDocumentId: doc.id,
      targetDocumentId: docSelected.id,
      position: TreeViewMoveModeEnum.FIRST_CHILD,
    });
  };

  return (
    <>
      <DocMoveModalStyle />
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        closeOnClickOutside
        size={isModal ? ModalSize.MEDIUM : ModalSize.FULL}
        hideCloseButton
        aria-label={t('Move Modal')}
        rightActions={
          <Box
            $direction="row-reverse"
            $padding={{ vertical: 'base', horizontal: 'md' }}
            $gap="small"
          >
            <Button
              aria-label={t('Move the document to the selected location')}
              variant="primary"
              fullWidth
              onClick={() => {
                if (!docSelected?.abilities.move) {
                  modalRequest.open();
                  return;
                }

                if (doc.nb_accesses_direct > 1) {
                  modalConfirmation.open();
                  return;
                }

                handleMoveDoc();
              }}
              disabled={!docSelected}
            >
              {t('Move here')}
            </Button>
            <Button
              aria-label={t('Cancel the move')}
              variant="secondary"
              fullWidth
              onClick={onClose}
            >
              {t('Cancel')}
            </Button>
          </Box>
        }
        title={
          <Box>
            <Box $position="absolute" $css="top: 4px; right: 4px;">
              <ButtonCloseModal
                aria-label={t('Close the move modal')}
                onClick={() => onClose()}
              />
            </Box>
            <Text
              as="h2"
              $margin="0"
              $size="h6"
              $align="flex-start"
              $padding={{ horizontal: 'md', top: 'md' }}
            >
              {t('Move')}
            </Text>
            <Box $margin={{ top: 'sm' }} $padding={{ horizontal: 'md' }}>
              <Text
                $size="sm"
                $variation="secondary"
                $display="inline"
                $weight="normal"
                $textAlign="left"
              >
                <Trans
                  i18nKey="Choose the new location for <strong>{{title}}</strong>."
                  values={{
                    title: docTitle,
                  }}
                  components={{ strong: <strong /> }}
                />
              </Text>
            </Box>
            <HorizontalSeparator />
          </Box>
        }
      >
        <Box
          $direction="column"
          $justify="space-between"
          className="--docs--doc-move-modal"
          onKeyDown={(e) => {
            // Close modal on Escape
            if (e.key === 'Escape') {
              onClose();
              return;
            }
            // Prevent keyboard events from bubbling to parent components (e.g., drag and drop)
            e.stopPropagation();
          }}
        >
          <QuickSearch
            placeholder={t('Search for a doc')}
            loading={loading}
            onFilter={handleInputSearch}
          >
            <Box
              $padding={{ horizontal: 'md', top: 'base' }}
              $height={isModal ? 'min(60vh, 350px)' : 'calc(100vh - 260px)'}
            >
              <Box>
                <DocSearchContent
                  groupName={search ? t('Search results') : t('All docs')}
                  search={search}
                  filterResults={(docResults) => docResults.id !== doc.id}
                  onSelect={handleSelect}
                  onLoadingChange={setLoading}
                  isSearchNotMandatory
                  renderSearchElement={(docSearch) => {
                    const isSelected = docSelected?.id === docSearch.id;

                    return (
                      <Box
                        className="--docs--doc-move-modal-search-item"
                        $direction="row"
                        $align="center"
                        $justify="space-between"
                        $width="100%"
                        $gap="sm"
                        $padding="3xs"
                        $css={css`
                          background-color: ${isSelected
                            ? 'var(--c--contextuals--background--semantic--brand--tertiary)'
                            : 'transparent'};
                          border: 1px solid
                            ${isSelected
                              ? 'var(--c--contextuals--border--semantic--brand--tertiary)'
                              : 'transparent'};
                          border-radius: var(--c--globals--spacings--3xs);

                          /* Arrow key navigation highlight */
                          &[data-selected='true'] {
                            ${!isSelected &&
                            `
                                background-color: var(--c--contextuals--background--semantic--contextual--primary);
                                border-color: transparent;
                              `}
                          }
                        `}
                        aria-selected={isSelected}
                      >
                        <DocsGridItemTitle
                          doc={docSearch}
                          withTooltip={false}
                        />
                        <DocsGridItemDate
                          doc={docSearch}
                          isDesktop={isModal}
                          isInTrashbin={false}
                        />
                      </Box>
                    );
                  }}
                />
              </Box>
            </Box>
          </QuickSearch>
        </Box>
      </Modal>
      {modalConfirmation.isOpen && (
        <ModalConfirmationMoveDoc
          isOpen={modalConfirmation.isOpen}
          onClose={modalConfirmation.onClose}
          onConfirm={handleMoveDoc}
          targetDocumentTitle={docTargetTitle}
        />
      )}
      {modalRequest.isOpen && docSelected?.id && (
        <AlertModalRequestAccess
          docId={docSelected.id}
          isOpen={modalRequest.isOpen}
          onClose={modalRequest.onClose}
          onConfirm={() => {
            modalRequest.onClose();
            onClose();
          }}
          targetDocumentTitle={docTargetTitle}
          title={t('Move document')}
        />
      )}
    </>
  );
};
