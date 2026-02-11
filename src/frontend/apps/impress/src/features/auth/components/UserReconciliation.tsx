import Image from 'next/image';
import { useTranslation } from 'react-i18next';

import error_img from '@/assets/icons/error-coffee.png';
import { Box, Loading, Text } from '@/components';

import { useUserReconciliationsQuery } from '../api';
import SuccessSvg from '../assets/mail-check-filled.svg';

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

  let render = (
    <Box $gap="xs" $align="center">
      <SuccessSvg />
      <Text
        as="h3"
        $textAlign="center"
        $maxWidth="350px"
        $theme="neutral"
        $margin="0"
        $size="16px"
      >
        {t('Email Address Confirmed')}
      </Text>
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
        )}
      </Text>
    </Box>
  );

  if (isError) {
    render = (
      <Box $gap="xs" $align="center">
        <Image
          src={error_img}
          alt=""
          width={300}
          style={{
            maxWidth: '100%',
            height: 'auto',
          }}
        />
        <Text
          as="p"
          $textAlign="center"
          $maxWidth="330px"
          $theme="neutral"
          $variation="secondary"
          $margin="0"
          $size="sm"
        >
          {t('An error occurred during email validation.')}
        </Text>
      </Box>
    );
  }

  return (
    <Box $align="center" $margin="auto" $padding={{ bottom: '2rem' }}>
      {render}
    </Box>
  );
};
