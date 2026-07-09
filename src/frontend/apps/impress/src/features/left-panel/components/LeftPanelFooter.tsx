import { UserMenu } from '@gouvfr-lasuite/ui-kit';
import { useTranslation } from 'react-i18next';

import { Box, SeparatedSection } from '@/components';
import { Waffle } from '@/components/Waffle';
import { ButtonLogin } from '@/features/auth';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { gotoLogout } from '@/features/auth/utils';
import { HelpMenu } from '@/features/help';
import { LanguagePicker } from '@/features/language/components/LanguagePicker';

export const LeftPanelFooter = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const userMenu = user || {
    full_name: t('Guest'),
    email: '',
  };

  return (
    <SeparatedSection showSeparator="top" $margin={{ top: 'auto' }}>
      <Box
        $padding={{ horizontal: 'sm' }}
        $justify="space-between"
        $direction="row"
      >
        <Box $direction="row" $align="center" $gap="0.2rem">
          <UserMenu
            user={userMenu}
            logout={user ? gotoLogout : undefined}
            actions={<LanguagePicker />}
            withMobileView={false}
          />
          <Waffle />
          <ButtonLogin />
        </Box>
        <HelpMenu />
      </Box>
    </SeparatedSection>
  );
};
