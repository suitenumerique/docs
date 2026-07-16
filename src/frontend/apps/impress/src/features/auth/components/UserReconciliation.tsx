import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import Error500Svg from '@/assets/icons/500.svg';
import EmailConfirmationSvg from '@/assets/icons/Mail.svg';
import { Box, Icon, Loading, Text } from '@/components';

import { useUserReconciliationsQuery } from '../api';

const ErrorActionLink = styled.button`
  display: flex;
  height: var(--md, 24px);
  padding: 0 var(--xxxs, 4px);
  justify-content: center;
  align-items: center;
  gap: var(--xxxs, 4px);
  color: var(--c--contextuals--content--semantic--neutral--tertiary);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--line-height-xs, 16px);
  text-decoration: none;

  svg {
    text-decoration: none;
  }

  .--docs--error-action-label {
    text-decoration: none;
  }

  &:hover:not(:disabled) .--docs--error-action-label {
    text-decoration: underline;
  }
`;

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
    <Box $align="center" $gap="0">
      <EmailConfirmationSvg width={102} height={72} aria-hidden="true" />
      <Text as="p" $weight="bold" $textAlign="center" $margin="0">
        {t('Email Address Confirmation')}
      </Text>
      <Text
        as="p"
        $textAlign="center"
        $maxWidth="330px"
        $margin="0"
        $css="
          color: var(--c--contextuals--content--semantic--neutral--secondary);
          font-size: 12px;
          font-weight: 400;
          line-height: var(--line-height-xs, 16px);
          margin-top: 4px;
        "
      >
        {t(
          'To complete the unification of your user accounts, please click the confirmation links sent to all the email addresses you provided.',
        )}
      </Text>
      <Box
        $direction="row"
        $align="flex-start"
        $gap="0.5rem"
        $css="margin-top: 20px;"
      >
        <ErrorActionLink onClick={() => window.location.reload()}>
          <Icon
            iconName="mail"
            variant="symbols-outlined"
            $size="16px"
            $color="inherit"
            $weight={500}
          />
          <span className="--docs--error-action-label">
            {t('Resend e-mail')}
          </span>
        </ErrorActionLink>
      </Box>
    </Box>
  );

  if (isError) {
    render = (
      <Box $align="center" $gap="0">
        <Error500Svg width={102} height={72} aria-hidden="true" />
        <Text
          as="p"
          $textAlign="center"
          $maxWidth="330px"
          $margin="0"
          $css="
            color: var(--c--contextuals--content--semantic--neutral--secondary);
            font-size: 12px;
            font-weight: 400;
            line-height: var(--line-height-xs, 16px);
            margin-top: 4px;
          "
        >
          {t('An error occurred during email validation.')}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      $align="center"
      $justify="center"
      $flex="1"
      $padding={{ bottom: '2rem' }}
    >
      {render}
    </Box>
  );
};
