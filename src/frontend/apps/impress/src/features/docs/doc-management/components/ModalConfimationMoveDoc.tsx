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
      title={t('Move document', {
        description: 'Title of the dialog to move a document',
      })}
      aria-label={t('Modal confirmation for moving a document', {
        description: 'Accessible name of the move confirmation dialog',
      })}
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
      confirmLabel={t('Move', {
        description: 'Button confirming the move of a document',
      })}
      onConfirm={onConfirm}
    />
  );
};
