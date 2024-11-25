import {
  Alert,
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { t } from 'i18next';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/router';

import { Box, Text, TextErrors } from '@/components';

import { useRemoveDoc } from '../api/useRemoveDoc';
import { Doc } from '../types';

interface ModalRemoveDocProps {
  onClose: () => void;
  doc: Doc;
}

export const ModalRemoveDoc = ({ onClose, doc }: ModalRemoveDocProps) => {
  const { toast } = useToastProvider();
  const { push } = useRouter();
  const pathname = usePathname();

  const {
    mutate: removeDoc,

    isError,
    error,
  } = useRemoveDoc({
    onSuccess: () => {
      toast(t('The document has been deleted.'), VariantType.SUCCESS, {
        duration: 4000,
      });
      if (pathname === '/') {
        onClose();
      } else {
        void push('/');
      }
    },
  });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      leftActions={
        <Button
          aria-label={t('Close the modal')}
          color="secondary"
          fullWidth
          onClick={() => onClose()}
        >
          {t('Cancel')}
        </Button>
      }
      onClose={() => onClose()}
      rightActions={
        <Button
          aria-label={t('Confirm deletion')}
          color="danger"
          fullWidth
          onClick={() =>
            removeDoc({
              docId: doc.id,
            })
          }
        >
          {t('Confirm deletion')}
        </Button>
      }
      size={ModalSize.MEDIUM}
      title={
        <Box $align="center" $gap="1rem">
          <Text $isMaterialIcon $size="48px" $theme="primary" $variation="600">
            delete_forever
          </Text>
          <Text as="h2" $size="h3" $margin="none">
            {t('Deleting the document "{{title}}"', { title: doc.title })}
          </Text>
        </Box>
      }
    >
      <Box
        $margin={{ bottom: 'xl' }}
        aria-label={t('Content modal to delete document')}
      >
        {!isError && (
          <Alert canClose={false} type={VariantType.WARNING}>
            <Text>
              {t('Are you sure you want to delete the document "{{title}}"?', {
                title: doc.title,
              })}
            </Text>
          </Alert>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
