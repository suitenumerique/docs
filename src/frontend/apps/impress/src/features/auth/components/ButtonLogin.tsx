import { Button } from '@gouvfr-lasuite/ui-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { BoxButton } from '@/components';

import ProConnectImg from '../assets/button-proconnect.svg';
import { LOGIN_URL } from '../conf';
import { useAuth } from '../hooks';
import { gotoLogin } from '../utils';

type ButtonLoginProps = {
  href?: string;
  variant?: 'primary' | 'tertiary';
  children?: ReactNode;
};

export const ButtonLogin = ({
  href = LOGIN_URL,
  variant = 'primary',
  children,
}: ButtonLoginProps) => {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const label = children ?? t('Sign in');

  if (authenticated) {
    return null;
  }

  return (
    <Button
      href={href}
      color="brand"
      size="small"
      variant={variant}
      aria-label={typeof label === 'string' ? label : t('Sign in')}
      className="--docs--button-login"
    >
      {label}
    </Button>
  );
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
