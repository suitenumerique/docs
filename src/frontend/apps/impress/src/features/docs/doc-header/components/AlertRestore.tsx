import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import {
  Button,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Card, Icon } from '@/components';
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
    <Card
      className="--docs--alert-restore"
      aria-label={t('Alert deleted document')}
      $radius={spacingsTokens['3xs']}
      $direction="row"
      $padding="xs"
      $flex={1}
      $align="center"
      $gap={spacingsTokens['3xs']}
      $justify="space-between"
      $theme="error"
    >
      <Box
        $withThemeInherited
        $direction="row"
        $align="center"
        $gap={spacingsTokens['2xs']}
      >
        <Icon
          $withThemeInherited
          data-testid="public-icon"
          iconName="delete"
          variant="symbols-outlined"
        />
        {t('Document deleted')}
      </Box>
      <Button
        onClick={() =>
          restoreDoc({
            docId: doc.id,
          })
        }
        color="error"
        variant="tertiary"
        size="nano"
        icon={
          <Icon
            iconName="undo"
            $withThemeInherited
            $size="18px"
            variant="symbols-outlined"
          />
        }
      >
        Restore
      </Button>
    </Card>
  );
};
