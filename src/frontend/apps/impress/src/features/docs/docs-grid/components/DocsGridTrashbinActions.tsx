import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DropdownMenu, DropdownMenuOption, Icon } from '@/components';
import { Doc, KEY_LIST_DOC, useRestoreDoc } from '@/docs/doc-management';

import { KEY_LIST_DOC_TRASHBIN } from '../api';

interface DocsGridTrashbinActionsProps {
  doc: Doc;
}

export const DocsGridTrashbinActions = ({
  doc,
}: DocsGridTrashbinActionsProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { mutate: restoreDoc, error } = useRestoreDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_DOC_TRASHBIN],
    options: {
      onSuccess: (_data) => {
        toast(t('The document has been restored.'), VariantType.SUCCESS, {
          duration: 4000,
        });
      },
      onError: () => {
        toast(
          t('An error occurred while restoring the document: {{error}}', {
            error: error?.message,
          }),
          VariantType.ERROR,
          {
            duration: 4000,
          },
        );
      },
    },
  });

  const options: DropdownMenuOption[] = [
    {
      label: t('Restore'),
      icon: (
        <Icon
          $size="20px"
          $theme="greyscale"
          $variation="1000"
          iconName="undo"
          aria-hidden="true"
          variant="symbols-outlined"
        />
      ),
      callback: () => {
        restoreDoc({
          docId: doc.id,
        });
      },
      testId: `docs-grid-actions-restore-${doc.id}`,
    },
  ];

  const documentTitle = doc.title || t('Untitled document');
  const menuLabel = t('Open the menu of actions for the document: {{title}}', {
    title: documentTitle,
  });

  return (
    <DropdownMenu
      options={options}
      label={menuLabel}
      aria-label={t('More options')}
    >
      <Icon
        data-testid={`docs-grid-actions-button-${doc.id}`}
        iconName="more_horiz"
        $theme="primary"
        $variation="600"
        $css={css`
          cursor: pointer;
          &:hover {
            opacity: 0.8;
          }
        `}
      />
    </DropdownMenu>
  );
};
