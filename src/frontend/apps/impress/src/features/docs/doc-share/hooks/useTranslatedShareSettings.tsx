import { useTranslation } from 'react-i18next';

import { LinkReach, LinkRole } from '@/docs/doc-management/types';

export const useTranslatedShareSettings = () => {
  const { t } = useTranslation();

  const linkReachTranslations = {
    [LinkReach.RESTRICTED]: t('Private', {
      description: 'Link sharing level: only invited people',
    }),
    [LinkReach.AUTHENTICATED]: t('Connected', {
      description: 'Link sharing level: any logged-in user',
    }),
    [LinkReach.PUBLIC]: t('Public', {
      description: 'Document visibility: anyone with the link can access',
    }),
  };

  const linkModeTranslations = {
    [LinkRole.READER]: t('Reading', {
      description: 'Link sharing role: read only',
    }),
    [LinkRole.EDITOR]: t('Editing', {
      description: 'Link sharing role: can edit',
    }),
  };

  const linkReachChoices = {
    [LinkReach.RESTRICTED]: {
      label: linkReachTranslations[LinkReach.RESTRICTED],
      icon: 'lock',
      value: LinkReach.RESTRICTED,
      descriptionReadOnly: t('Only invited people can access', {
        description: 'Description of the private link sharing level',
      }),
      descriptionEdit: t('Only invited people can access', {
        description: 'Description of the private link sharing level',
      }),
    },
    [LinkReach.AUTHENTICATED]: {
      label: linkReachTranslations[LinkReach.AUTHENTICATED],
      icon: 'vpn_lock',
      value: LinkReach.AUTHENTICATED,
      descriptionReadOnly: t(
        'Anyone with the link can view the document if they are logged in',
        { description: 'Description of the connected level, read only' },
      ),
      descriptionEdit: t(
        'Anyone with the link can edit the document if they are logged in',
        { description: 'Description of the connected level, can edit' },
      ),
    },
    [LinkReach.PUBLIC]: {
      label: linkReachTranslations[LinkReach.PUBLIC],
      icon: 'public',
      value: LinkReach.PUBLIC,
      descriptionReadOnly: t('Anyone with the link can see the document', {
        description: 'Description of the public level, read only',
      }),
      descriptionEdit: t('Anyone with the link can edit the document', {
        description: 'Description of the public level, can edit',
      }),
    },
  };

  return {
    linkReachTranslations,
    linkModeTranslations,
    linkReachChoices,
  };
};
