import { useTranslation } from 'react-i18next';

import { DropdownMenuOption } from '@/components';

import { KEY_DOC, KEY_LIST_DOC, useDeleteMaskDoc, useMaskDoc } from '../api';
import { Doc } from '../types';

export const useMaskDocOption = (doc: Doc) => {
  const { t } = useTranslation();
  const maskDoc = useMaskDoc({
    listInvalideQueries: [KEY_LIST_DOC, KEY_DOC],
  });
  const deleteMaskDoc = useDeleteMaskDoc({
    listInvalideQueries: [KEY_LIST_DOC, KEY_DOC],
  });

  const leaveDocOption: DropdownMenuOption = doc.is_masked
    ? {
        label: t('Join the doc'),
        icon: 'login',
        callback: () => {
          deleteMaskDoc.mutate({
            id: doc.id,
          });
        },
        disabled: !doc.abilities.mask,
        testId: `docs-grid-actions-mask-${doc.id}`,
      }
    : {
        label: t('Leave doc'),
        icon: 'logout',
        callback: () => {
          maskDoc.mutate({
            id: doc.id,
          });
        },
        disabled: !doc.abilities.mask,
        testId: `docs-grid-actions-mask-${doc.id}`,
      };

  return leaveDocOption;
};
