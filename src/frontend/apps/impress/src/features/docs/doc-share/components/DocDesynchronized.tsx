import { Button } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  useUpdateDocLink,
} from '@/docs/doc-management';

import Desync from './../assets/desynchro.svg';
import Undo from './../assets/undo.svg';

interface DocDesynchronizedProps {
  doc: Doc;
}

export const DocDesynchronized = ({ doc }: DocDesynchronizedProps) => {
  const { t } = useTranslation();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();

  const { mutate: updateDocLink } = useUpdateDocLink({
    listInvalideQueries: [KEY_LIST_DOC, KEY_DOC],
  });

  return (
    <Box
      $background={colorsTokens['primary-100']}
      $padding="3xs"
      $direction="row"
      $align="center"
      $justify="space-between"
      $gap={spacingsTokens['4xs']}
      $color={colorsTokens['primary-800']}
      $css={css`
        border: 1px solid ${colorsTokens['primary-300']};
        border-radius: ${spacingsTokens['2xs']};
      `}
    >
      <Box $direction="row" $align="center" $gap={spacingsTokens['3xs']}>
        <Desync />
        <Text $size="xs" $theme="primary" $variation="800" $weight="400">
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
          color="primary-text"
          icon={<Undo />}
        >
          {t('Restore')}
        </Button>
      )}
    </Box>
  );
};
