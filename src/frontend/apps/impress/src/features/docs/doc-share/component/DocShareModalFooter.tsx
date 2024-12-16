import {
  Button,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { HorizontalSeparator } from '@/components/separators/HorizontalSeparator';
import { Doc } from '@/features/docs';

import { DocVisibility } from './DocVisibility';

type Props = {
  doc: Doc;
  onClose: () => void;
};

export const DocShareModalFooter = ({ doc, onClose }: Props) => {
  const canShare = doc.abilities.accesses_manage;
  const { toast } = useToastProvider();
  const { t } = useTranslation();
  return (
    <Box
      $css={css`
        flex-shrink: 0;
      `}
    >
      <HorizontalSeparator />
      {canShare && (
        <>
          <DocVisibility doc={doc} />
          <HorizontalSeparator />
        </>
      )}
      <Box $direction="row" $justify="space-between" $padding="base">
        <Button
          fullWidth={false}
          onClick={() => {
            navigator.clipboard
              .writeText(window.location.href)
              .then(() => {
                toast(t('Link Copied !'), VariantType.SUCCESS, {
                  duration: 3000,
                });
              })
              .catch(() => {
                toast(t('Failed to copy link'), VariantType.ERROR, {
                  duration: 3000,
                });
              });
          }}
          color="tertiary"
          icon={<span className="material-icons">add_link</span>}
        >
          {t('Copy link')}
        </Button>
        <Button onClick={onClose} color="primary">
          {t('Ok')}
        </Button>
      </Box>
    </Box>
  );
};
