import { Button, Modal, ModalSize } from '@openfun/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';

import { Doc } from '../types';

interface ModalRenameDocProps {
  onClose: () => void;
  doc: Doc;
}

export const ModalRenameDoc = ({ onClose, doc }: ModalRenameDocProps) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(doc.title);
  return (
    <Modal
      closeOnClickOutside
      title={
        <Text $size="h6" $margin={{ all: '0' }} $align="flex-start">
          {t('Rename')}
        </Text>
      }
      isOpen
      onClose={onClose}
      size={ModalSize.SMALL}
      rightActions={
        <>
          <Button
            aria-label={t('Close the modal')}
            color="secondary"
            fullWidth
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Confirm rename')}
            fullWidth
            onClick={() => console.log('rename', title)}
          >
            {t('Rename')}
          </Button>
        </>
      }
    >
      <Box $padding={{ top: 'base' }}>
        <input
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          defaultValue={title}
          //   label={t('Nom du document')}
          onChange={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setTitle(e.target.value);
          }}
        />
      </Box>
    </Modal>
  );
};
