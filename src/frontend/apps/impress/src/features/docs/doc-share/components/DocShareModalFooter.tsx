import { Button } from '@gouvfr-lasuite/ui-components';
import { announce } from '@react-aria/live-announcer';
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

  const handleCopyLink = async () => {
    const copied = await copyDocLink();

    announce(
      copied
        ? t('Link Copied !', {
            description: 'Toast confirming a link was copied to the clipboard',
          })
        : t('Failed to copy link', {
            description: 'Toast shown when copying a link failed',
          }),
      copied ? 'polite' : 'assertive',
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
    </Box>
  );
};
