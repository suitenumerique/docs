import { Button, Tooltip, useModal } from '@gouvfr-lasuite/cunningham-react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { Doc } from '@/docs/doc-management';
import { useFocusStore } from '@/stores';

const DocShareModal = dynamic(
  () =>
    import('@/docs/doc-share/components/DocShareModal').then((mod) => ({
      default: mod.DocShareModal,
    })),
  { ssr: false },
);

type Props = {
  doc: Doc;
  disabled: boolean;
};
export const DocsGridItemSharedButton = ({ doc, disabled }: Props) => {
  const { t } = useTranslation();
  const sharedCount = doc.nb_accesses_direct;
  const isShared = sharedCount - 1 > 0;
  const shareModal = useModal();
  const { addLastFocus, restoreFocus } = useFocusStore();

  if (!isShared) {
    return <Box $minWidth="50px">&nbsp;</Box>;
  }

  return (
    <>
      <Tooltip
        content={
          <Text $textAlign="center">
            {t('Shared with {{count}} users', { count: sharedCount })}
          </Text>
        }
        placement="top"
        className="--docs--doc-tooltip-grid-item-shared-button"
      >
        <Button
          className="--docs--doc-grid-item-shared-button"
          aria-label={t('Open the sharing settings for the document')}
          data-testid={`docs-grid-item-shared-button-${doc.id}`}
          style={{
            padding: `0 var(--c--globals--spacings--xxxs) 0 var(--c--globals--spacings--xxxs)`,
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            addLastFocus(event.currentTarget as HTMLElement);
            shareModal.open();
          }}
          color="brand"
          variant="secondary"
          size="nano"
          icon={
            <Icon
              $theme="brand"
              $variation="secondary"
              iconName="group"
              disabled={disabled}
              variant="filled"
            />
          }
          disabled={disabled}
        >
          {sharedCount}
        </Button>
      </Tooltip>
      {shareModal.isOpen && (
        <DocShareModal
          doc={doc}
          onClose={() => {
            shareModal.close();
            restoreFocus();
          }}
        />
      )}
    </>
  );
};
