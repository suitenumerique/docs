import { Button } from '@gouvfr-lasuite/cunningham-react';
import { Trans, useTranslation } from 'react-i18next';

import { AlertModal, Box, Icon, Text } from '@/components';

import { useDocAccessRequests } from '../api/useDocAccessRequest';

import { ButtonAccessRequest } from './DocShareAccessRequest';

interface AlertModalRequestAccessProps {
  docId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  targetDocumentTitle: string;
  title: string;
}

export const AlertModalRequestAccess = ({
  docId,
  isOpen,
  onClose,
  onConfirm,
  targetDocumentTitle,
  title,
}: AlertModalRequestAccessProps) => {
  const { t } = useTranslation();
  const { data: requests } = useDocAccessRequests({
    docId,
    page: 1,
  });

  const hasRequested = !!(
    requests && requests?.results.find((request) => request.document === docId)
  );

  return (
    <AlertModal
      onClose={onClose}
      isOpen={isOpen}
      title={title}
      aria-label={t('Request access modal')}
      description={
        <>
          <Text $display="inline">
            <Trans
              i18nKey="You don't have permission to move this document to <strong>{{targetDocumentTitle}}</strong>. You need edit access to the destination. Request access, then try again."
              values={{
                targetDocumentTitle,
              }}
              components={{ strong: <strong /> }}
            />
          </Text>
          {hasRequested && (
            <Text
              $weight="bold"
              $margin={{ top: 'sm' }}
              $direction="row"
              $align="center"
            >
              <Icon
                iconName="person_check"
                $margin={{ right: 'xxs' }}
                variant="symbols-outlined"
              />
              {t('You have already requested access to this document.')}
            </Text>
          )}
        </>
      }
      confirmLabel={t('Request access')}
      onConfirm={onConfirm}
      rightActions={
        <Box $direction="row" $gap="small">
          <Button
            aria-label={t('Cancel')}
            variant="secondary"
            fullWidth
            onClick={onClose}
            autoFocus
          >
            {t('Cancel')}
          </Button>
          <ButtonAccessRequest docId={docId} onClick={onConfirm} />
        </Box>
      }
    />
  );
};
