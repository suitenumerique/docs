import { Button } from '@gouvfr-lasuite/cunningham-react';
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
      variant="tertiary"
      icon={
        <Icon $withThemeInherited iconName={isPanelOpen ? 'close' : 'menu'} />
      }
      className="--docs--button-toggle-panel"
      data-testid="header-menu-toggle"
    />
  );
};
