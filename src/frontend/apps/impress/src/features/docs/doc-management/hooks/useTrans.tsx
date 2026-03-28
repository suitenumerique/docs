import { useTranslation } from 'react-i18next';

import { DocDefaultFilter, Role } from '../types';

export const useTrans = () => {
  const { t } = useTranslation();

  const translatedRoles = {
    [Role.READER]: t('Reader'),
    [Role.EDITOR]: t('Editor'),
    [Role.ADMIN]: t('Administrator'),
    [Role.OWNER]: t('Owner'),
  };

  const translatedFilters = {
    [DocDefaultFilter.ALL_DOCS]: t('All docs'),
    [DocDefaultFilter.MY_DOCS]: t('My docs'),
    [DocDefaultFilter.SHARED_WITH_ME]: t('Shared with me'),
    [DocDefaultFilter.TRASHBIN]: t('Trashbin'),
  };

  return {
    transRole: (role: Role) => {
      return translatedRoles[role];
    },
    transFilter: (filter: DocDefaultFilter) => {
      return translatedFilters[filter];
    },
    untitledDocument: t('Untitled document'),
    translatedRoles,
    translatedFilters,
  };
};
