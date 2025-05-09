import { useTranslation } from 'react-i18next';

import { Role } from '../types';

export const useTrans = () => {
  const { t } = useTranslation();

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
    untitledDocument: t('Untitled document'),
    translatedRoles,
  };
};
