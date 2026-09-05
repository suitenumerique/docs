import {
  ButtonProps,
  DropdownMenuItem,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import {
  type Doc,
  KEY_LIST_DOC,
  KEY_LIST_FAVORITE_DOC,
  useRestoreDoc,
} from '@/docs/doc-management';
import { DocToolBox } from '@/docs/doc-management/components/DocToolBox';
import MoreIcon from '@/icons/more_horiz.svg';

import { KEY_LIST_DOC_TRASHBIN } from '../api';

interface DocsGridActionsProps {
  doc: Doc;
  isInTrashbin?: boolean;
}

const TOOLBOX_BUTTON_PROPS: ButtonProps = {
  icon: <MoreIcon width={16} height={16} aria-hidden="true" />,
  size: 'nano',
};

export const DocsGridActions = ({
  doc,
  isInTrashbin,
}: DocsGridActionsProps) => {
  return isInTrashbin ? (
    <DocsGridTrashbinActions doc={doc} />
  ) : (
    <DocToolBox
      doc={doc}
      isCurrentDoc={false}
      buttonProps={TOOLBOX_BUTTON_PROPS}
    />
  );
};

interface DocsGridTrashbinActionsProps {
  doc: Doc;
}

export const DocsGridTrashbinActions = ({
  doc,
}: DocsGridTrashbinActionsProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { mutate: restoreDoc } = useRestoreDoc({
    listInvalidQueries: [
      KEY_LIST_DOC,
      KEY_LIST_DOC_TRASHBIN,
      KEY_LIST_FAVORITE_DOC,
    ],
    options: {
      onSuccess: (_data) => {
        toast(t('The document has been restored.'), VariantType.SUCCESS, {
          duration: 4000,
        });
      },
      onError: (error) => {
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

  if (!doc.abilities.restore) {
    return null;
  }

  const options: DropdownMenuItem[] = [
    {
      label: t('Restore'),
      icon: (
        <Icon
          $size="20px"
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

  return (
    <DocToolBox
      doc={doc}
      isCurrentDoc={false}
      buttonProps={TOOLBOX_BUTTON_PROPS}
      optionsDefault={options}
    />
  );
};
