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
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
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
      $color={colorsTokens['danger-800']}
      $background={colorsTokens['danger-100']}
      $radius={spacingsTokens['3xs']}
      $direction="row"
      $padding="xs"
      $flex={1}
      $align="center"
      $gap={spacingsTokens['3xs']}
      $css={css`
        border: 1px solid var(--c--theme--colors--danger-300, #e3e3fd);
      `}
      $justify="space-between"
    >
      <Box $direction="row" $align="center" $gap={spacingsTokens['2xs']}>
        <Icon
          $theme="danger"
          $variation="700"
          data-testid="public-icon"
          iconName="delete"
          variant="symbols-outlined"
        />
        <Text $theme="danger" $variation="700" $weight="500">
          {t('Document deleted')}
        </Text>
      </Box>
      <BoxButton
        onClick={() =>
          restoreDoc({
            docId: doc.id,
          })
        }
        $direction="row"
        $gap="0.2rem"
        $theme="danger"
        $variation="600"
        $align="center"
      >
        <Icon
          iconName="undo"
          $theme="danger"
          $variation="600"
          $size="18px"
          variant="symbols-outlined"
        />
        <Text $theme="danger" $variation="600" $size="s" $css="line-height:1;">
          {t('Restore')}
        </Text>
      </BoxButton>
    </Box>
  );
};
