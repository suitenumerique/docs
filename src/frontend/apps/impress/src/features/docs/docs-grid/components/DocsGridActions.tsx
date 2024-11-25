import { useModal } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { DropdownMenu, DropdownMenuOption, Icon } from '@/components';
import { Doc, ModalRemoveDoc } from '@/features/docs/doc-management';

interface DocsGridActionsProps {
  doc: Doc;
}

export const DocsGridActions = ({ doc }: DocsGridActionsProps) => {
  const { t } = useTranslation();
  const deleteModal = useModal();

  const options: DropdownMenuOption[] = [
    {
      label: t('Remove'),
      icon: 'delete',
      callback: () => deleteModal.open(),
      disabled: !doc.abilities.destroy,
      testId: `docs-grid-actions-remove-${doc.id}`,
    },
  ];

  return (
    <>
      <DropdownMenu options={options}>
        <Icon
          data-testid={`docs-grid-actions-button-${doc.id}`}
          iconName="more_horiz"
          $theme="primary"
          $variation="600"
        />
      </DropdownMenu>

      {deleteModal.isOpen && (
        <ModalRemoveDoc onClose={deleteModal.onClose} doc={doc} />
      )}
    </>
  );
};
