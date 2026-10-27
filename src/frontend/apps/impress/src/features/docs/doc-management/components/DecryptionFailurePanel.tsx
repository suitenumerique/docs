import { Button } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';

import { Icon, StyledLink } from '@/components';

import type { DecryptionFailure } from '../stores/useProviderStore';

import { EncryptionEmptyState } from './EncryptionLayout';

interface Props {
  failure: DecryptionFailure;
}

/** Shown instead of the editor when an encrypted document cannot be opened. */
export const DecryptionFailurePanel = ({ failure }: Props) => {
  const { t } = useTranslation();

  const copy = {
    key_unavailable: {
      title: t('This document was shared with a previous key'),
      description: t(
        'That key is no longer on your account, most likely because you reset your encryption. Ask the document owner to remove you from its members and add you again.',
      ),
    },
    key_mismatch: {
      title: t('This document was encrypted with a different key'),
      description: t(
        'Your current encryption key cannot open it. Ask the document owner to remove you from its members and add you again.',
      ),
    },
    content_integrity: {
      title: t('This document cannot be decrypted'),
      description: t(
        'Your key is correct, but the stored content is damaged or was altered, so it cannot be trusted. Contact the owner of this document or your support.',
      ),
    },
    unknown: {
      title: t('This document could not be decrypted'),
      description: t(
        'Something went wrong while decrypting this document. Try again.',
      ),
    },
  }[failure];

  return (
    <EncryptionEmptyState
      title={copy.title}
      description={copy.description}
      actions={
        <>
          <StyledLink href="/">
            <Button
              size="small"
              color="neutral"
              variant="tertiary"
              icon={<Icon iconName="home" $withThemeInherited />}
            >
              {t('Home')}
            </Button>
          </StyledLink>
          {failure === 'unknown' && (
            <Button
              size="small"
              variant="tertiary"
              onClick={() => window.location.reload()}
              icon={<Icon iconName="refresh" $withThemeInherited />}
            >
              {t('Retry')}
            </Button>
          )}
        </>
      }
    />
  );
};
