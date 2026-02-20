import { Trans, useTranslation } from 'react-i18next';

import { AlertModal, Text } from '@/components';

interface ModalConfirmationMoveDocProps {
  targetDocumentTitle: string;
  onConfirm: () => void;
  onClose: () => void;
  isOpen: boolean;
}

export const ModalConfirmationMoveDoc = ({
  targetDocumentTitle,
  onClose,
  onConfirm,
  isOpen,
}: ModalConfirmationMoveDocProps) => {
  const { t } = useTranslation();

  return (
    <AlertModal
      onClose={onClose}
      isOpen={isOpen}
      title={t('Move document')}
      aria-label={t('Modal confirmation for moving a document')}
      description={
        <Text $display="inline">
          <Trans
            i18nKey="By moving this document to <strong>{{targetDocumentTitle}}</strong>, it will lose its current access rights and inherit the permissions of that document. <strong>This access change cannot be undone.</strong>"
            values={{
              targetDocumentTitle,
            }}
            components={{ strong: <strong /> }}
          />
        </Text>
      }
      confirmLabel={t('Move')}
      onConfirm={onConfirm}
    />
  );
};
