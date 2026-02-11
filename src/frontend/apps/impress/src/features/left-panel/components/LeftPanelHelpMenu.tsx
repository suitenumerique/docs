import { Button } from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu, ModalSize } from '@gouvfr-lasuite/ui-kit';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';
import { useHelpMenuOptions } from '@/features/left-panel/hooks/useHelpMenuOptions';
import { OnBoarding } from '@/features/on-boarding/components/OnBoarding';

export const LeftPanelHelpMenu = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((open) => !open);
  }, []);

  const options = useHelpMenuOptions({ onOpenOnboarding: openModal });
  const footerLink = {
    label: t('Learn more docs features'),
    href: '',
  };

  return (
    <>
      <Box
        $css={css`
          .c__dropdown-menu-trigger {
            width: fit-content;
            justify-content: flex-start;
          }
        `}
      >
        <DropdownMenu
          options={options}
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
        >
          <Box $direction="row" $align="center">
            <span className="sr-only">{t('Open onboarding menu')}</span>
            <Button
              aria-label={t('Open onboarding menu')}
              color="neutral"
              variant="tertiary"
              iconPosition="left"
              icon={
                <Icon
                  $withThemeInherited
                  iconName="help_outline"
                  aria-hidden="true"
                />
              }
              onClick={toggleMenu}
            />
          </Box>
        </DropdownMenu>
      </Box>

      <OnBoarding
        isOpen={isModalOpen}
        size={ModalSize.LARGE}
        onClose={closeModal}
        onSkip={closeModal}
        footerLink={footerLink}
      />
    </>
  );
};
