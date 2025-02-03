import { Button } from '@openfun/cunningham-react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { BoxButton } from '@/components';

import ProConnectImg from '../assets/button-proconnect.svg?url';
import { useAuth } from '../hooks';
import { gotoLogin, gotoLogout } from '../utils';

export const ButtonLogin = () => {
  const { t } = useTranslation();
  const { authenticated } = useAuth();

  if (!authenticated) {
    return (
      <Button onClick={gotoLogin} color="primary-text" aria-label={t('Login')}>
        {t('Login')}
      </Button>
    );
  }

  return (
    <Button onClick={gotoLogout} color="primary-text" aria-label={t('Logout')}>
      {t('Logout')}
    </Button>
  );
};

export const ProConnectButton = () => {
  const { t } = useTranslation();

  return (
    <BoxButton
      onClick={gotoLogin}
      aria-label={t('Proconnect Login')}
      $css={css`
        background-color: var(--c--theme--colors--primary-text);
        &:hover {
          background-color: var(--c--theme--colors--primary-action);
        }
      `}
    >
      <Image src={ProConnectImg} alt={t('ProConnect Image')} />
    </BoxButton>
  );
};
