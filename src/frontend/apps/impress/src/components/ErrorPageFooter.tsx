import { UserMenu } from '@gouvfr-lasuite/ui-kit';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { Waffle } from '@/components/Waffle';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { gotoLogout } from '@/features/auth/utils';
import { HelpMenu } from '@/features/help';

const footerButtonStyles = css`
  display: flex;
  height: var(--Height, 32px);
  min-width: var(--Height, 32px);
  padding: 4px;
  justify-content: center;
  align-items: center;
  gap: 7px;
  border-radius: 4px;
  color: var(--c--contextuals--content--semantic--neutral--tertiary);
`;

export const ErrorPageFooter = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const userMenu = user || {
    full_name: t('Guest'),
    email: '',
  };

  return (
    <Box
      as="footer"
      $direction="row"
      $align="center"
      $width="100%"
      $css={css`
        align-self: stretch;
        padding: var(--sm, 12px);
        margin-top: auto;
        gap: 0.2rem;
        border-top: 1px solid
          var(--c--contextuals--border--semantic--neutral--default);

        .c__button--neutral--tertiary,
        .c__button--brand--tertiary {
          ${footerButtonStyles}
        }
      `}
    >
      {user && (
        <UserMenu user={userMenu} logout={gotoLogout} withMobileView={false} />
      )}
      <Waffle />
      <HelpMenu colorButton="neutral" />
    </Box>
  );
};
