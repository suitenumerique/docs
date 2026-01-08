import {
  Button,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Card, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, KEY_DOC, KEY_LIST_DOC } from '@/docs/doc-management';

import { useUpdateDocLink } from '../api/useUpdateDocLink';

import Desync from './../assets/desynchro.svg';
import Undo from './../assets/undo.svg';

interface DocDesynchronizedProps {
  doc: Doc;
}

export const DocDesynchronized = ({ doc }: DocDesynchronizedProps) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { toast } = useToastProvider();

  const { mutate: updateDocLink } = useUpdateDocLink({
    listInvalidQueries: [KEY_LIST_DOC, KEY_DOC],
    onSuccess: () => {
      toast(t('The document visibility restored.'), VariantType.SUCCESS, {
        duration: 2000,
      });
    },
  });

  return (
    <Card
      $padding="3xs"
      $direction="row"
      $align="center"
      $justify="space-between"
      $gap={spacingsTokens['4xs']}
      $theme="brand"
    >
      <Box
        $withThemeInherited
        $direction="row"
        $align="center"
        $gap={spacingsTokens['3xs']}
      >
        <Desync />
        <Text $size="xs" $withThemeInherited $weight="400">
          {t('The link sharing rules differ from the parent document')}
        </Text>
      </Box>
      {doc.abilities.accesses_manage && (
        <Button
          onClick={() =>
            updateDocLink({
              id: doc.id,
              link_reach: doc.ancestors_link_reach,
              link_role: doc?.ancestors_link_role || undefined,
            })
          }
          size="small"
          color="brand"
          variant="tertiary"
          icon={<Undo />}
        >
          {t('Restore')}
        </Button>
      )}
    </Card>
  );
};
