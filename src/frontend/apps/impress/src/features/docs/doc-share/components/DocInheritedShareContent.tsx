import { Button, Modal, ModalSize, useModal } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { Access, useDoc } from '../../doc-management';
import SimpleFileIcon from '../../docs-grid/assets/simple-document.svg';

import { DocShareMemberItem } from './DocShareMemberItem';
const ShareModalStyle = createGlobalStyle`
  .c__modal__title {
    padding-bottom: 0 !important;
  }
  .c__modal__scroller {
    padding: 15px 15px !important;
  }
`;

type Props = {
  accesses: Map<string, Access[]>;
};

export const DocInheritedShareContent = ({ accesses }: Props) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();

  // Check if accesses map is empty
  const hasAccesses = accesses.size > 0;

  if (!hasAccesses) {
    return null;
  }

  return (
    <Box $gap={spacingsTokens.sm}>
      <Box
        $gap={spacingsTokens.sm}
        $padding={{
          horizontal: spacingsTokens.base,
          vertical: spacingsTokens.sm,
          bottom: '0px',
        }}
      >
        <Text $variation="1000" $weight="bold" $size="sm">
          {t('Inherited share')}
        </Text>

        {Array.from(accesses.keys()).map((documentId) => (
          <DocInheritedShareContentItem
            key={documentId}
            accesses={accesses.get(documentId) ?? []}
            document_id={documentId}
          />
        ))}
      </Box>
    </Box>
  );
};

type DocInheritedShareContentItemProps = {
  accesses: Access[];
  document_id: string;
};
export const DocInheritedShareContentItem = ({
  accesses,
  document_id,
}: DocInheritedShareContentItemProps) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { data: doc } = useDoc({ id: document_id });
  const accessModal = useModal();

  if (!doc) {
    return null;
  }

  return (
    <>
      <Box
        $gap={spacingsTokens.sm}
        $width="100%"
        $direction="row"
        $align="center"
        $justify="space-between"
      >
        <Box $direction="row" $align="center" $gap={spacingsTokens.sm}>
          <SimpleFileIcon />
          <Box>
            <Text $variation="1000" $weight="bold" $size="sm">
              {doc.title ?? t('Untitled document')}
            </Text>
            <Text $variation="600" $weight="400" $size="xs">
              {t('Members of this page have access')}
            </Text>
          </Box>
        </Box>
        <Button color="primary-text" size="small" onClick={accessModal.open}>
          {t('See access')}
        </Button>
      </Box>
      {accessModal.isOpen && (
        <Modal
          isOpen
          closeOnClickOutside
          onClose={accessModal.close}
          title={
            <Box $align="flex-start">
              <Text $variation="1000" $weight="bold" $size="sm">
                {t('Access inherited from the parent page')}
              </Text>
            </Box>
          }
          size={ModalSize.MEDIUM}
        >
          <ShareModalStyle />
          <Box $padding={{ top: spacingsTokens.sm }}>
            {accesses.map((access) => (
              <DocShareMemberItem
                key={access.id}
                doc={doc}
                access={access}
                isInherited
              />
            ))}
          </Box>
        </Modal>
      )}
    </>
  );
};
