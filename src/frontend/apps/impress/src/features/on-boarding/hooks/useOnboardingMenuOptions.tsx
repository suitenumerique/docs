import { type DropdownMenuOption } from '@gouvfr-lasuite/ui-kit';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import WandAndStarsIcon from '../assets/wand-and-stars.svg';

export interface UseOnboardingMenuOptionsParams {
  onOpenOnboarding: () => void;
}

export const useOnboardingMenuOptions = ({
  onOpenOnboarding,
}: UseOnboardingMenuOptionsParams) => {
  const { t } = useTranslation();

  return useMemo<DropdownMenuOption[]>(
    () => [
      {
        label: t('Onboarding'),
        icon: <WandAndStarsIcon aria-hidden="true" />,
        callback: onOpenOnboarding,
      },
    ],
    [onOpenOnboarding, t],
  );
};
