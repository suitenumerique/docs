import { Button } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/core/auth';

export const ButtonLogin = () => {
  const { t } = useTranslation();
  const { logout, authenticated, login } = useAuthStore();

  if (!authenticated) {
    return (
      <Button onClick={login} color="primary-text" aria-label={t('Login')}>
        {t('Login')}
      </Button>
    );
  }

  return (
    <Button onClick={logout} color="primary-text" aria-label={t('Logout')}>
      {t('Logout')}
    </Button>
  );
};
