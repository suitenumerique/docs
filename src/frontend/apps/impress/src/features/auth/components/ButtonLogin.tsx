import { Button } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

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
