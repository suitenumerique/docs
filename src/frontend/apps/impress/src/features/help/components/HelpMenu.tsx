import {
  Button,
  ButtonProps,
  useModal,
} from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-kit';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import BubbleTextIcon from '@/assets/icons/ui-kit/bubble-text.svg';
import DocIcon from '@/assets/icons/ui-kit/doc.svg';
import LegalIcon from '@/assets/icons/ui-kit/legal.svg';
import HelpIcon from '@/assets/icons/ui-kit/question-mark.svg';
import WandAndStarsIcon from '@/assets/icons/ui-kit/wand-and-stars.svg';
import { Box } from '@/components';
import { useConfig } from '@/core';
import { openCrispChat } from '@/services';

import { OnBoarding } from './OnBoarding';

const HelpMenuStyle = createGlobalStyle`
  .c__dropdown-menu {
    overflow: visible;
  }
`;

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
  const documentationUrl = config?.theme_customization?.help?.documentation_url;
  const crispEnabled = !!config?.CRISP_WEBSITE_ID;
  const legalLinks = config?.theme_customization?.help?.legal_links;

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((open) => !open);
  }, []);

  const openExternalLink = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const hasLegalLinks =
    !!legalLinks?.personal_data ||
    !!legalLinks?.terms_of_use ||
    !!legalLinks?.accessibility_statement ||
    !!legalLinks?.legal_notice;

  const options = useMemo<DropdownMenuItem[]>(
    () => [
      {
        label: t('Get Support'),
        icon: <BubbleTextIcon aria-hidden="true" width="24" height="24" />,
        callback: openCrispChat,
        isHidden: !crispEnabled,
      },
      {
        label: t('Documentation'),
        icon: <DocIcon aria-hidden="true" width="24" height="24" />,
        callback: () => {
          if (documentationUrl) {
            openExternalLink(documentationUrl);
          }
        },
        isHidden: !documentationUrl,
      },
      {
        label: t('Onboarding'),
        icon: <WandAndStarsIcon aria-hidden="true" width="24" height="24" />,
        callback: modalOnbording.open,
        isHidden: !onboardingEnabled,
      },
      {
        label: t('Legal'),
        icon: <LegalIcon aria-hidden="true" width="24" height="24" />,
        isHidden: !hasLegalLinks,
        children: [
          {
            label: t('Personal data and cookies'),
            callback: () => openExternalLink(legalLinks?.personal_data ?? ''),
            isHidden: !legalLinks?.personal_data,
          },
          {
            label: t('Terms of use'),
            callback: () => openExternalLink(legalLinks?.terms_of_use ?? ''),
            isHidden: !legalLinks?.terms_of_use,
          },
          {
            label: t('Accessibility statement'),
            callback: () =>
              openExternalLink(legalLinks?.accessibility_statement ?? ''),
            isHidden: !legalLinks?.accessibility_statement,
          },
          {
            label: t('Legal notice'),
            callback: () => openExternalLink(legalLinks?.legal_notice ?? ''),
            isHidden: !legalLinks?.legal_notice,
          },
        ],
      },
    ],
    [
      t,
      crispEnabled,
      documentationUrl,
      modalOnbording.open,
      onboardingEnabled,
      openExternalLink,
      legalLinks,
      hasLegalLinks,
    ],
  );

  return (
    <>
      {isMenuOpen && <HelpMenuStyle />}
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
              icon={
                <HelpIcon
                  aria-hidden="true"
                  color="inherit"
                  width="24"
                  height="24"
                />
              }
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
