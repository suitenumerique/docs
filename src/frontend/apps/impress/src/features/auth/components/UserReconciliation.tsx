import { Button } from '@gouvfr-lasuite/cunningham-react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import error_img from '@/assets/icons/error-planetes.png';
import { Box, Icon, Loading, StyledLink, Text } from '@/components';

import { useUserReconciliationsQuery } from '../api';
import success_gif from '../assets/rocket.gif';

const StyledButton = styled(Button)`
  width: fit-content;
`;

interface UserReconciliationProps {
  type: 'active' | 'inactive';
  reconciliationId: string;
}

export const UserReconciliation = ({
  type,
  reconciliationId,
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
    <>
      <Image src={success_gif} alt="" unoptimized priority />
      <Text
        as="p"
        $textAlign="center"
        $maxWidth="350px"
        $theme="neutral"
        $margin="0"
      >
        {t('Email validated successfully !')}
      </Text>
    </>
  );

  if (isError) {
    render = (
      <>
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
          $maxWidth="350px"
          $theme="neutral"
          $margin="0"
        >
          {t('An error occurred during email validation.')}
        </Text>
      </>
    );
  }

  return (
    <Box $align="center" $margin="auto" $gap="md" $padding={{ bottom: '2rem' }}>
      {render}

      <Box $direction="row" $gap="sm">
        <StyledLink href="/">
          <StyledButton
            color="neutral"
            icon={
              <Icon
                iconName="house"
                variant="symbols-outlined"
                $withThemeInherited
              />
            }
          >
            {t('Home')}
          </StyledButton>
        </StyledLink>
      </Box>
    </Box>
  );
};
