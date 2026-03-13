import { useModal } from '@gouvfr-lasuite/cunningham-react';
import { useEffect } from 'react';

import { OnBoarding } from '@/features/help';

import { useOnboardingDone } from '../api/useOnboardingDone';

export const FirstConnection = () => {
  const modalOnbording = useModal();
  const { mutate: onboardingDone, isPending } = useOnboardingDone();

  useEffect(() => {
    if (isPending) {
      return;
    }

    modalOnbording.open();
  }, [modalOnbording, isPending]);

  const onClose = () => {
    onboardingDone();
    modalOnbording.close();
  };

  if (!modalOnbording.isOpen && isPending) {
    return null;
  }

  return <OnBoarding isOpen={modalOnbording.isOpen} onClose={onClose} />;
};
