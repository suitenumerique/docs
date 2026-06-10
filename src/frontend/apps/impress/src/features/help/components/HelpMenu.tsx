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

import { OnBoarding } from './OnBoarding';

// HelpMenuStyle is mounted only when isMenuOpen is true so this global
// `.c__dropdown-menu { overflow: visible; }` rule does not affect other dropdowns.
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
  const supportMailto = config?.theme_customization?.help?.support_mailto;
  const legalLinks = config?.theme_customization?.help?.legal_links;

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((open) => !open);
  }, []);

  const openExternalLink = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const openMailto = useCallback((mailto: string) => {
    window.location.href = mailto;
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
        callback: () => {
          if (supportMailto) {
            openMailto(supportMailto);
          }
        },
        isHidden: !supportMailto,
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
            callback: () => {
              if (legalLinks?.personal_data) {
                openExternalLink(legalLinks.personal_data);
              }
            },
            isHidden: !legalLinks?.personal_data,
          },
          {
            label: t('Terms of use'),
            callback: () => {
              if (legalLinks?.terms_of_use) {
                openExternalLink(legalLinks.terms_of_use);
              }
            },
            isHidden: !legalLinks?.terms_of_use,
          },
          {
            label: t('Accessibility statement'),
            callback: () => {
              if (legalLinks?.accessibility_statement) {
                openExternalLink(legalLinks.accessibility_statement);
              }
            },
            isHidden: !legalLinks?.accessibility_statement,
          },
          {
            label: t('Legal notice'),
            callback: () => {
              if (legalLinks?.legal_notice) {
                openExternalLink(legalLinks.legal_notice);
              }
            },
            isHidden: !legalLinks?.legal_notice,
          },
        ],
      },
    ],
    [
      t,
      supportMailto,
      documentationUrl,
      openMailto,
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
