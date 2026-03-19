import {
  Button,
  ButtonProps,
  useModal,
} from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu } from '@gouvfr-lasuite/ui-kit';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, DropdownMenuOption } from '@/components';
import { useConfig } from '@/core';

import HelpOutlineIcon from '../assets/help-outline.svg';
import WandAndStarsIcon from '../assets/wand-and-stars.svg';

import { OnBoarding } from './OnBoarding';

export const HelpMenu = ({
  colorButton,
}: {
  colorButton?: ButtonProps['color'];
}) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const modalOnbording = useModal();
  const { data: config } = useConfig();
  const onboardingEnabled = config?.theme_customization?.onboarding?.enabled;

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((open) => !open);
  }, []);

  const options = useMemo<DropdownMenuOption[]>(
    () => [
      {
        label: t('Onboarding'),
        icon: <WandAndStarsIcon aria-hidden="true" />,
        callback: modalOnbording.open,
        show: onboardingEnabled,
      },
    ],
    [modalOnbording.open, t, onboardingEnabled],
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
            <Button
              aria-label={t('Open help menu')}
              color={colorButton || 'neutral'}
              variant="tertiary"
              iconPosition="left"
              icon={<HelpOutlineIcon aria-hidden="true" />}
              onClick={toggleMenu}
            />
          </Box>
        </DropdownMenu>
      </Box>

      <OnBoarding
        isOpen={modalOnbording.isOpen}
        onClose={modalOnbording.close}
      />
    </>
  );
};
