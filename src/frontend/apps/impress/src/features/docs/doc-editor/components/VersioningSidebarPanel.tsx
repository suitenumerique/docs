import { RenderInPortalElement } from '@blocknote/react';
import { VersioningSidebar } from '@blocknote/react/versioning';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';

import { VersionHistoryDebug } from './VersionHistoryDebug';

/**
 * Full-page right-side panel hosting the BlockNote version history sidebar.
 *
 * RenderInPortalElement renders the panel outside the editor's scroll container
 * with the editor's theme and focus handling.
 */
export const VersioningSidebarPanel = ({
  onClose,
  debug,
}: {
  onClose: () => void;
  debug: Omit<React.ComponentProps<typeof VersionHistoryDebug>, 'onDismiss'>;
}) => {
  const { t } = useTranslation();
  const [showDebug, setShowDebug] = useState(true);

  return (
    <RenderInPortalElement target={document.body}>
      <Box
        as="aside"
        className="--docs--versioning-sidebar-panel"
        aria-label={t('Version history side panel')}
        $direction="column"
        $width="300px"
        $height="100dvh"
        $position="fixed"
        $zIndex={25}
        $background="var(--c--contextuals--background--surface--tertiary)"
        $css={`
            top: 0;
            right: 0;
            flex-shrink: 0;
            border-left: 1px solid var(--c--contextuals--border--surface--primary);
            box-shadow: -10px 0px 10px 0px rgba(0, 0, 0, 0.05);
            overflow-y: auto;
            overflow-x: hidden;
          `}
      >
        {showDebug && (
          <VersionHistoryDebug
            {...debug}
            onDismiss={() => setShowDebug(false)}
          />
        )}
        <VersioningSidebar onClose={onClose} />
      </Box>
    </RenderInPortalElement>
  );
};
