import { useTranslation } from 'react-i18next';

import { LinkReach, LinkRole } from '@/features/docs/doc-management/types';

export const useTranslatedShareSettings = () => {
  const { t } = useTranslation();

  const linkReachTranslations = {
    [LinkReach.RESTRICTED]: t('Private'),
    [LinkReach.AUTHENTICATED]: t('Connected'),
    [LinkReach.PUBLIC]: t('Public'),
  };

  const linkModeTranslations = {
    [LinkRole.READER]: t('Reading'),
    [LinkRole.EDITOR]: t('Edition'),
  };

  const linkReachChoices = {
    [LinkReach.RESTRICTED]: {
      label: linkReachTranslations[LinkReach.RESTRICTED],
      icon: 'lock',
      value: LinkReach.RESTRICTED,
      descriptionReadOnly: t('Only invited people can access'),
      descriptionEdit: t('Only invited people can access'),
    },
    [LinkReach.AUTHENTICATED]: {
      label: linkReachTranslations[LinkReach.AUTHENTICATED],
      icon: 'corporate_fare',
      value: LinkReach.AUTHENTICATED,
      descriptionReadOnly: t(
        'Anyone with the link can see the document provided they are logged in',
      ),
      descriptionEdit: t(
        'Anyone with the link can edit provided they are logged in',
      ),
    },
    [LinkReach.PUBLIC]: {
      label: linkReachTranslations[LinkReach.PUBLIC],
      icon: 'public',
      value: LinkReach.PUBLIC,
      descriptionReadOnly: t('Anyone with the link can see the document'),
      descriptionEdit: t('Anyone with the link can edit the document'),
    },
  };

  return {
    linkReachTranslations,
    linkModeTranslations,
    linkReachChoices,
  };
};
