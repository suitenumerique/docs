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

  const getNotAllowedMessage = (
    canUpdate: boolean,
    isLastOwner: boolean,
    isOtherOwner: boolean,
  ) => {
    if (!canUpdate) {
      return undefined;
    }

    if (isLastOwner) {
      return t(
        'You are the sole owner of this group, make another member the group owner before you can change your own role or be removed from your document.',
      );
    }

    if (isOtherOwner) {
      return t('You cannot update the role or remove other owner.');
    }

    return undefined;
  };

  return {
    transRole: (role: Role) => {
      return translatedRoles[role];
    },
    untitledDocument: t('Untitled document'),
    translatedRoles,
    getNotAllowedMessage,
  };
};
