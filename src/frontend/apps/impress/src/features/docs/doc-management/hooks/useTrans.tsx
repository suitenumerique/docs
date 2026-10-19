import { useTranslation } from 'react-i18next';

import { DocDefaultFilter, Role } from '../types';

export const useTrans = () => {
  const { t } = useTranslation();

  const translatedRoles = {
    [Role.READER]: t('Reader', {
      description: 'Role on a document: can only read',
    }),
    [Role.EDITOR]: t('Editor', { description: 'Role on a document: can edit' }),
    [Role.ADMIN]: t('Administrator', {
      description: 'Role on a document: can edit and manage sharing',
    }),
    [Role.OWNER]: t('Owner', {
      description: 'Role on a document: full control, including deletion',
    }),
  };

  const translatedFilters = {
    [DocDefaultFilter.ALL_DOCS]: t('Recent', {
      description: 'Name of the filter listing recently opened docs',
    }),
    [DocDefaultFilter.MY_DOCS]: t('My docs', {
      description: 'Name of the filter listing docs owned by the user',
    }),
    [DocDefaultFilter.SHARED_WITH_ME]: t('Shared with me', {
      description: 'Name of the filter listing docs shared with the user',
    }),
    [DocDefaultFilter.STARRED]: t('Starred', {
      description: "Name of the filter listing the user's favorite docs",
    }),
    [DocDefaultFilter.TRASHBIN]: t('Trashbin', {
      description: 'Name of the filter listing deleted docs',
    }),
  };

  return {
    transRole: (role: Role) => {
      return translatedRoles[role];
    },
    transFilter: (filter: DocDefaultFilter) => {
      return translatedFilters[filter];
    },
    untitledDocument: t('Untitled document', {
      description: 'Name displayed for a document without a title',
    }),
    translatedRoles,
    translatedFilters,
  };
};
