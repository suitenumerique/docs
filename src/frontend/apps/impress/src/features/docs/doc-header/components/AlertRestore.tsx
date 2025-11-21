import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  useRestoreDoc,
} from '@/docs/doc-management';
import { KEY_LIST_DOC_TRASHBIN } from '@/docs/docs-grid';

export const AlertRestore = ({ doc }: { doc: Doc }) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const treeContext = useTreeContext<Doc>();
  const { spacingsTokens } = useCunninghamTheme();
  const { mutate: restoreDoc, error } = useRestoreDoc({
    listInvalidQueries: [KEY_LIST_DOC, KEY_LIST_DOC_TRASHBIN, KEY_DOC],
    options: {
      onSuccess: (_data) => {
        // It will force the tree to be reloaded
        treeContext?.setRoot(undefined as unknown as Doc);

        toast(t('The document has been restored.'), VariantType.SUCCESS, {
          duration: 4000,
        });
      },
      onError: () => {
        toast(
          t('An error occurred while restoring the document: {{error}}', {
            error: error?.message,
          }),
          VariantType.ERROR,
          {
            duration: 4000,
          },
        );
      },
    },
  });

  return (
    <Box
      className="--docs--alert-restore"
      aria-label={t('Alert deleted document')}
      $radius={spacingsTokens['3xs']}
      $direction="row"
      $padding="xs"
      $flex={1}
      $align="center"
      $gap={spacingsTokens['3xs']}
      $css={css`
        border: 1px solid
          var(--c--contextuals--border--semantic--error--tertiary);
      `}
      $justify="space-between"
      $withThemeBG
      $theme="error"
      $variation="tertiary"
    >
      <Box
        $color="inherit"
        $direction="row"
        $align="center"
        $gap={spacingsTokens['2xs']}
      >
        <Icon
          $color="inherit"
          data-testid="public-icon"
          iconName="delete"
          variant="symbols-outlined"
        />
        {t('Document deleted')}
      </Box>
      <BoxButton
        onClick={() =>
          restoreDoc({
            docId: doc.id,
          })
        }
        $direction="row"
        $gap="0.2rem"
        $color="inherit"
        $align="center"
      >
        <Icon
          iconName="undo"
          $color="inherit"
          $size="18px"
          variant="symbols-outlined"
        />
        <Text $color="inherit" $size="s" $css="line-height:1;">
          {t('Restore')}
        </Text>
      </BoxButton>
    </Box>
  );
};
