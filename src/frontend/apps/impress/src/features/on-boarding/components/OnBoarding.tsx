import { Button } from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu, OnboardingModal } from '@gouvfr-lasuite/ui-kit';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';

import { useOnboardingMenuOptions } from '../hooks/useOnboardingMenuOptions';
import { useOnboardingSteps } from '../hooks/useOnboardingSteps';

export const OnBoarding = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen((open) => !open);
  };

  const steps = useOnboardingSteps();
  const options = useOnboardingMenuOptions({ onOpenOnboarding: openModal });

  return (
    <>
      <Box
        $css={css`
          .c__dropdown-menu-trigger {
            display: flex;
            justify-content: flex-start;
          }
        `}
      >
        <DropdownMenu
          options={options}
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
        >
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
        </DropdownMenu>
      </Box>

      <OnboardingModal
        isOpen={isModalOpen}
        appName={t('Discover Docs')}
        mainTitle={t('Learn the core principles')}
        steps={steps}
        onClose={closeModal}
        onComplete={closeModal}
      />
    </>
  );
};
