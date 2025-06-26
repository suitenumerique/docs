import { Button } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { Access, useDocStore } from '../../doc-management';

import { DocShareMemberItem } from './DocShareMemberItem';

type Props = {
  rawAccesses: Access[];
};

export const DocInheritedShareContent = ({ rawAccesses }: Props) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { currentDoc } = useDocStore();
  const router = useRouter();

  // Check if accesses map is empty
  const hasAccesses = rawAccesses.length > 0;

  if (!hasAccesses) {
    return null;
  }

  return (
    <>
      <Box $gap={spacingsTokens.sm} $padding={{ top: spacingsTokens.sm }}>
        <HorizontalSeparator $withPadding={false} />
        <Box
          $gap={spacingsTokens.sm}
          $padding={{
            horizontal: spacingsTokens.base,
            // vertical: spacingsTokens.sm,
            // bottom: '0px',
          }}
        >
          <Box $direction="row" $align="center" $gap={spacingsTokens['4xs']}>
            <Text $variation="1000" $weight="bold" $size="sm">
              {t('People with access via the parent document')}
            </Text>
            <div>
              <Button
                onClick={() => {
                  void router.push(`/docs/${rawAccesses[0].document.id}`);
                }}
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
            </div>
          </Box>
          {rawAccesses.map((access) => (
            <Fragment key={access.id}>
              <DocShareMemberItem
                doc={currentDoc}
                access={access}
                isInherited
              />
            </Fragment>
          ))}
        </Box>
      </Box>
    </>
  );
};
