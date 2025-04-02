import { useTranslation } from 'react-i18next';

import { Doc, Role } from '../types';

export const useTrans = (doc?: Doc) => {
  const { t } = useTranslation();
  const isChild = doc && doc.nb_accesses_ancestors > 1;

  const translatedRoles = {
    [Role.READER]: t('Reader'),
    [Role.EDITOR]: t('Editor'),
    [Role.ADMIN]: t('Administrator'),
    [Role.OWNER]: t('Owner'),
  };

  return {
    transRole: (role: Role) => {
      return translatedRoles[role];
    },
    untitledDocument: isChild ? t('Untitled page') : t('Untitled document'),
    translatedRoles,
  };
};
