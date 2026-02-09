import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/';
import { useLeftPanelStore } from '@/features/left-panel';

export const ButtonTogglePanel = () => {
  const { t } = useTranslation();
  const { isPanelOpenMobile, togglePanel } = useLeftPanelStore();

  return (
    <Button
      size="medium"
      onClick={() => togglePanel()}
      aria-label={t(
        isPanelOpenMobile ? 'Close the header menu' : 'Open the header menu',
      )}
      aria-expanded={isPanelOpenMobile}
      variant="tertiary"
      icon={
        <Icon
          $withThemeInherited
          iconName={isPanelOpenMobile ? 'close' : 'menu'}
        />
      }
      className="--docs--button-toggle-panel"
      data-testid="header-menu-toggle"
    />
  );
};
