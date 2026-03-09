import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { BoxButton } from '@/components';

import ProConnectImg from '../assets/button-proconnect.svg';
import { useAuth } from '../hooks';
import { gotoLogin } from '../utils';
import { AccountMenu } from './AccountMenu';

export const ButtonLogin = () => {
  const { t } = useTranslation();
  const { authenticated } = useAuth();

  if (!authenticated) {
    return (
      <Button
        onClick={() => gotoLogin()}
        color="brand"
        variant="tertiary"
        aria-label={t('Login')}
        className="--docs--button-login"
      >
        {t('Login')}
      </Button>
    );
  }

  return <AccountMenu />;
};

export const ProConnectButton = () => {
  const { t } = useTranslation();

  return (
    <BoxButton
      onClick={() => gotoLogin()}
      aria-label={t('Proconnect Login')}
      $css={css`
        background-color: var(
          --c--contextuals--background--semantic--brand--primary
        );
        &:hover {
          background-color: var(
            --c--contextuals--background--semantic--brand--primary-hover
          );
        }
      `}
      $radius="4px"
      className="--docs--proconnect-button"
    >
      <ProConnectImg />
    </BoxButton>
  );
};
