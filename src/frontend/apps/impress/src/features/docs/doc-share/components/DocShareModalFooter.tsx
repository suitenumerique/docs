import { Button } from '@gouvfr-lasuite/ui-components';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, HorizontalSeparator, Icon } from '@/components';
import { Doc, useCopyDocLink } from '@/docs/doc-management';

import { DocVisibility } from './DocVisibility';

type DocShareModalFooterProps = {
  doc: Doc;
  onClose: () => void;
};

export const DocShareModalFooter = ({
  doc,
  onClose,
}: DocShareModalFooterProps) => {
  const copyDocLink = useCopyDocLink(doc.id);
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState('');
  const latestCopyId = useRef(0);

  const handleCopyLink = async () => {
    const copyId = ++latestCopyId.current;

    // Reset first, so copying twice in a row is announced again.
    setCopyStatus('');

    const copied = await copyDocLink();

    // Ignore the result of a copy that a newer click has superseded.
    if (copyId !== latestCopyId.current) {
      return;
    }

    setCopyStatus(
      copied
        ? t('Link Copied !', {
            description: 'Toast confirming a link was copied to the clipboard',
          })
        : t('Failed to copy link', {
            description: 'Toast shown when copying a link failed',
          }),
    );
  };

  return (
    <Box
      $css={css`
        flex-shrink: 0;
      `}
      className="--docs--doc-share-modal-footer"
    >
      <HorizontalSeparator $margin={{ vertical: 'sm' }} />

      <DocVisibility doc={doc} />
      <HorizontalSeparator $margin={{ vertical: 'sm' }} />

      <Box
        $direction="row"
        $justify="space-between"
        $padding={{ horizontal: 'base', bottom: 'base' }}
      >
        <Button
          fullWidth={false}
          onClick={() => void handleCopyLink()}
          variant="secondary"
          icon={<Icon iconName="add_link" $withThemeInherited />}
        >
          {t('Copy link', {
            description: 'Dropdown menu item to copy the document link',
          })}
        </Button>
        <Button onClick={onClose}>
          {t('OK', { description: 'Button closing a dialog' })}
        </Button>
      </Box>
      {/*
        The copy confirmation is only shown as a toast, which assistive
        technologies do not announce. This region is present before the copy
        happens so the status message is read out (RGAA 7.5).
      */}
      <Box className="sr-only" role="status" aria-live="polite">
        {copyStatus}
      </Box>
    </Box>
  );
};
