import { useTranslation } from 'react-i18next';

import { Box, Loading, Text } from '@/components';

import { useUserReconciliationsQuery } from '../api';
import EmailConfirmationSvg from '../assets/email-confirmation.svg';
import EmailValidationErrorSvg from '../assets/email-validation-error.svg';

interface UserReconciliationProps {
  reconciliationId: string;
  type: 'active' | 'inactive';
}

export const UserReconciliation = ({
  reconciliationId,
  type,
}: UserReconciliationProps) => {
  const { t } = useTranslation();
  const { data: userReconciliations, isError } = useUserReconciliationsQuery({
    type,
    reconciliationId,
  });

  if (!userReconciliations && !isError) {
    return (
      <Loading
        $height="100vh"
        $width="100vw"
        $position="absolute"
        $css="top: 0;"
      />
    );
  }

  return (
    <Box
      $align="center"
      $gap="xs"
      $padding={{ horizontal: 'base' }}
      className="--docs--user-reconciliation"
    >
      {isError ? (
        <EmailValidationErrorSvg aria-hidden="true" />
      ) : (
        <EmailConfirmationSvg aria-hidden="true" />
      )}
      <Box $align="center" $gap="3xs">
        <Text
          as="h1"
          $size="md"
          $weight="bold"
          $textAlign="center"
          $margin="0"
          $theme="neutral"
          $variation="primary"
        >
          {isError
            ? t('An error occurred during email validation.', {
                description:
                  'Title shown when the email confirmation of an account merge fails',
              })
            : t('Email Address Confirmed', {
                description:
                  'Title shown after an email address is confirmed during an account merge',
              })}
        </Text>
        {!isError && (
          <Text
            as="p"
            $textAlign="center"
            $maxWidth="330px"
            $theme="neutral"
            $variation="secondary"
            $margin="0"
            $size="sm"
          >
            {t(
              'To complete the unification of your user accounts, please click the confirmation links sent to all the email addresses you provided.',
              { description: 'Instruction of the account merge page' },
            )}
          </Text>
        )}
      </Box>
    </Box>
  );
};
