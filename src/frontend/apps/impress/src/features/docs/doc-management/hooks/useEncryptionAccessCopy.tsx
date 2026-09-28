import { useTranslation } from 'react-i18next';

import type { Doc } from '../types';

/**
 * Title and description explaining why the current user cannot open an
 * encrypted document they are a member of, shared by the document page and
 * the share dialog. Being a pending member is told apart from having no
 * encryption and from having no usable key: each asks something different of
 * the user.
 */
export const useEncryptionAccessCopy = (
  doc: Pick<Doc, 'is_pending_encryption_for_user'> | undefined,
  needsSetup: boolean,
) => {
  const { t } = useTranslation();

  if (doc?.is_pending_encryption_for_user) {
    return {
      title: t('Waiting for access'),
      description: needsSetup
        ? t(
            'This document was encrypted before you enabled encryption, so its key could not be shared with you. Enable encryption on your account: you will get access the next time the document owner opens it.',
          )
        : t(
            'This document was encrypted before you enabled encryption, so its key could not be shared with you then. You will get access the next time the document owner opens it.',
          ),
    };
  }

  if (needsSetup) {
    return {
      title: t('Encrypted document'),
      description: t(
        'This document is encrypted. You must enable encryption on your account to access it.',
      ),
    };
  }

  return {
    title: t('Encrypted document'),
    description: t(
      'This encrypted document holds no key for you. Ask the document owner to add you to its members.',
    ),
  };
};
