import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import ProConnectImg from '../assets/button-proconnect.svg';
import { useAuth } from '../hooks';
import { gotoLogin, gotoLogout } from '../utils';

export const ButtonLogin = () => {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const { colorsTokens } = useCunninghamTheme();

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

  return (
    <Box
      $css={css`
        .--docs--button-logout:focus-visible {
          box-shadow: 0 0 0 2px ${colorsTokens['brand-400']} !important;
          border-radius: var(--c--globals--spacings--st);
        }
      `}
    >
      <Button
        onClick={gotoLogout}
        color="brand"
        variant="tertiary"
        aria-label={t('Logout')}
        className="--docs--button-logout"
      >
        {t('Logout')}
      </Button>
    </Box>
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
