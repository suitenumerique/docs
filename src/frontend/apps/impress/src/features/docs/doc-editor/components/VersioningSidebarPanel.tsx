import { formatVersionDate } from '@blocknote/core/extensions';
import { RenderInPortalElement, useBlockNoteEditor } from '@blocknote/react';
import {
  DeleteVersionItem,
  NameVersionItem,
  VersionMenu,
  VersionMenuItem,
  VersioningSidebar,
  useRestoreVersionAction,
  useVersionSnapshot,
} from '@blocknote/react/versioning';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertModal, Box, Icon } from '@/components';

import { VersionHistoryDebug } from './VersionHistoryDebug';

interface RestoreRequest {
  snapshotId: string;
  label: string;
  execute: () => void | Promise<void>;
}

const ConfirmRestoreVersionItem = ({
  onRequest,
}: {
  onRequest: (request: RestoreRequest) => void;
}) => {
  const action = useRestoreVersionAction();
  const { snapshot, isStart } = useVersionSnapshot();
  const { dictionary } = useBlockNoteEditor();

  if (!action.available) {
    return null;
  }

  return (
    <VersionMenuItem
      icon={<Icon iconName="restore" />}
      onClick={() =>
        onRequest({
          snapshotId: snapshot.id,
          label:
            snapshot.name ??
            (isStart
              ? dictionary.versioning.start_of_document
              : formatVersionDate(snapshot.createdAt)),
          execute: action.execute,
        })
      }
    >
      {dictionary.versioning.restore_menuitem}
    </VersionMenuItem>
  );
};

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
  const [pending, setPending] = useState<RestoreRequest>();
  const pendingRef = useRef<RestoreRequest | undefined>(undefined);
  const submitting = useRef(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(
    () => () => {
      pendingRef.current = undefined;
    },
    [],
  );

  const requestRestore = (request: RestoreRequest) => {
    if (pendingRef.current || submitting.current) {
      return;
    }
    pendingRef.current = request;
    setPending(request);
  };

  const cancelRestore = () => {
    if (!submitting.current) {
      pendingRef.current = undefined;
      setPending(undefined);
    }
  };

  const confirmRestore = async () => {
    const request = pendingRef.current;
    if (!request || submitting.current) {
      return;
    }
    submitting.current = true;
    setIsRestoring(true);
    try {
      // BlockNote owns restore, preview, errors and closing the sidebar.
      await request.execute();
    } finally {
      submitting.current = false;
      // Closing history or changing documents unmounts this owner. The
      // submitted restore still runs, but must not update stale dialog state.
      if (pendingRef.current === request) {
        pendingRef.current = undefined;
        setPending(undefined);
        setIsRestoring(false);
      }
    }
  };

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
        <VersioningSidebar
          onClose={onClose}
          snapshotMenu={
            <VersionMenu>
              <NameVersionItem />
              <ConfirmRestoreVersionItem onRequest={requestRestore} />
              <DeleteVersionItem />
            </VersionMenu>
          }
        />
      </Box>
      {pending && (
        <AlertModal
          isOpen
          title={t('Restore version')}
          description={t('Restore “{{version}}”?', { version: pending.label })}
          confirmLabel={t('Restore')}
          confirmDisabled={isRestoring}
          onClose={cancelRestore}
          onConfirm={() => void confirmRestore()}
        />
      )}
    </RenderInPortalElement>
  );
};
