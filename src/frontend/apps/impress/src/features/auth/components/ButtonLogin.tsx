import { Button } from '@gouvfr-lasuite/ui-components';
import { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { BoxButton } from '@/components';

import ProConnectImg from '../assets/button-proconnect.svg';
import { LOGIN_URL } from '../conf';
import { useAuth } from '../hooks';
import { gotoLogin } from '../utils';

type ButtonLoginProps = ComponentProps<typeof Button>;

export const ButtonLogin = ({
  href = LOGIN_URL,
  children,
  ...props
}: ButtonLoginProps) => {
  const { t } = useTranslation();
  const { authenticated } = useAuth();

  if (authenticated) {
    return null;
  }

  return (
    <Button
      color="brand"
      size="small"
      variant="primary"
      className="--docs--button-login"
      {...props}
      href={href}
    >
      {children ?? t('Sign in')}
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
