import { UserMenu } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box } from '@/components';
import { Waffle } from '@/components/Waffle';
import { ButtonLogin, gotoLogout, useAuth } from '@/features/auth';
import {
  userColorForeground,
  userColorsForId,
} from '@/features/auth/userColors';
import { HelpMenu } from '@/features/help';
import { LanguagePicker } from '@/features/language/components/LanguagePicker';

const FooterActionsGlobalStyle = createGlobalStyle<{ $userColor: string }>`
  .user-menu__actions .c__language-picker{
    width: auto;
  }

  /* UserMenu does not expose avatar props. Include its portalled account menu. */
  .--docs--footer-actions .c__avatar,
  .user-menu__popover .user-menu__content__body__user-info > .c__avatar {
    background: ${({ $userColor }) => $userColor};
    color: ${({ $userColor }) => userColorForeground($userColor)};
  }
`;

type FooterActionsProps = {
  withLogin?: boolean;
};

export const FooterActions = ({ withLogin }: FooterActionsProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const userMenu = user || {
    full_name: t('Guest', {
      description: 'Name displayed for a user not logged in',
    }),
    email: '',
  };

  return (
    <>
      <FooterActionsGlobalStyle
        $userColor={userColorsForId(user?.id ?? 'anonymous').color}
      />
      <Box
        $padding={{ horizontal: 'sm' }}
        $direction="row"
        $align="center"
        $gap="3xs"
        $justify="space-between"
        className="--docs--footer-actions"
      >
        <Box $direction="row" $align="center" $gap="3xs">
          <UserMenu
            user={userMenu}
            logout={user ? gotoLogout : undefined}
            actions={<LanguagePicker />}
            withMobileView={false}
          />
          <Waffle />
          {withLogin && <ButtonLogin />}
        </Box>
        <HelpMenu />
      </Box>
    </>
  );
};
