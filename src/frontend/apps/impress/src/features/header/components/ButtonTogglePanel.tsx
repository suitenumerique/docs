import { Button } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/';
import { useLeftPanelStore } from '@/features/left-panel';

export const ButtonTogglePanel = () => {
  const { t } = useTranslation();
  const { isPanelOpen, togglePanel } = useLeftPanelStore();

  return (
    <Button
      size="medium"
      onClick={() => togglePanel()}
      aria-label={t(
        isPanelOpen ? 'Close the header menu' : 'Open the header menu',
      )}
      aria-expanded={isPanelOpen}
      color="tertiary-text"
      icon={
        <Icon
          $variation="800"
          $theme="primary"
          iconName={isPanelOpen ? 'close' : 'menu'}
        />
      }
      className="--docs--button-toggle-panel"
    />
  );
};
