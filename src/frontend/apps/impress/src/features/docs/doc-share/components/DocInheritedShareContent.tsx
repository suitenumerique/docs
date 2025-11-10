import { Button } from '@openfun/cunningham-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator, Icon, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { Access, useDocStore } from '../../doc-management';

import { DocShareMemberItem } from './DocShareMember';

type DocInheritedShareContentProps = {
  rawAccesses: Access[];
};

export const DocInheritedShareContent = ({
  rawAccesses,
}: DocInheritedShareContentProps) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { currentDoc } = useDocStore();

  // Check if accesses map is empty
  const hasAccesses = rawAccesses.length > 0;

  if (!hasAccesses) {
    return null;
  }

  return (
    <Box
      $gap={spacingsTokens.sm}
      $padding={{ top: spacingsTokens.sm }}
      className="--docs--doc-inherited-share-content"
    >
      <HorizontalSeparator $withPadding={false} />
      <Box
        $gap={spacingsTokens.sm}
        $padding={{
          horizontal: spacingsTokens.base,
        }}
      >
        <Box $direction="row" $align="center" $gap={spacingsTokens['4xs']}>
          <Text $variation="1000" $weight="bold" $size="sm">
            {t('People with access via the parent document')}
          </Text>
          <Box>
            <StyledLink href={`/docs/${rawAccesses[0].document.id}`}>
              <Button
                size="small"
                icon={
                  <Icon
                    $theme="greyscale"
                    $variation="600"
                    iconName="open_in_new"
                  />
                }
                color="tertiary-text"
              />
            </StyledLink>
          </Box>
        </Box>
        {rawAccesses.map((access) => (
          <Fragment key={access.id}>
            <DocShareMemberItem doc={currentDoc} access={access} isInherited />
          </Fragment>
        ))}
      </Box>
    </Box>
  );
};
