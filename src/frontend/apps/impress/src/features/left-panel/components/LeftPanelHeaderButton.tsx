import { Button } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { useCreateDoc } from '@/features/docs/doc-management';

import { useDocCreationLoadingStore, useLeftPanelStore } from '../stores';

export const LeftPanelHeaderButton = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { togglePanel } = useLeftPanelStore();
  const { setIsCreatingDoc } = useDocCreationLoadingStore();
  const [isNavigating, setIsNavigating] = useState(false);

  const { mutate: createDoc, isPending: isDocCreating } = useCreateDoc({
    onSuccess: (doc) => {
      setIsNavigating(true);
      // Wait for navigation to complete
      router.push(`/docs/${doc.id}`).then(() => {
        // The skeleton will be disabled by the [id] page once the data is loaded
        setIsNavigating(false);
        togglePanel();
      });
    },
    onError: () => {
      // If there's an error, disable the skeleton
      setIsCreatingDoc(false);
      setIsNavigating(false);
    },
  });

  const handleClick = () => {
    setIsCreatingDoc(true);
    createDoc();
  };

  const isLoading = isDocCreating || isNavigating;

  return (
    <Button
      data-testid="new-doc-button"
      color="primary"
      onClick={handleClick}
      icon={<Icon $variation="000" iconName="add" aria-hidden="true" />}
      disabled={isLoading}
    >
      {t('New doc')}
    </Button>
  );
};
