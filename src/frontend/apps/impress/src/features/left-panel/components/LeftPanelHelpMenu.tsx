import { Button } from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu } from '@gouvfr-lasuite/ui-kit';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';
import { OnBoarding } from '@/features/on-boarding/components/OnBoarding';

import WandAndStarsIcon from '../assets/wand-and-stars.svg';

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

  const options = useMemo(
    () => [
      {
        label: t('Onboarding'),
        icon: <WandAndStarsIcon aria-hidden="true" />,
        callback: openModal,
      },
    ],
    [openModal, t],
  );

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
        onClose={closeModal}
        onSkip={closeModal}
        footerLink={{
          label: t('Learn more docs features'),
          href: '',
        }}
      />
    </>
  );
};
