import { Button } from '@openfun/cunningham-react';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { User } from '@/features/auth';

type Props = {
  user: User;
  onRemoveUser?: (user: User) => void;
};
export const DocShareAddMemberListItem = ({ user, onRemoveUser }: Props) => {
  const { spacingsTokens, colorsTokens, fontSizesTokens } =
    useCunninghamTheme();

  return (
    <Box
      data-testid={`doc-share-add-member-${user.email}`}
      $radius={spacingsTokens['3xs']}
      $direction="row"
      $height="fit-content"
      $justify="center"
      $align="center"
      $gap={spacingsTokens['3xs']}
      $background={colorsTokens['greyscale-250']}
      $padding={{
        left: spacingsTokens['xs'],
        right: spacingsTokens['4xs'],
        vertical: spacingsTokens['4xs'],
      }}
      $css={css`
        color: ${colorsTokens['greyscale-1000']};
        font-size: ${fontSizesTokens['xs']};
      `}
      className="--docs--doc-share-add-member-list-item"
    >
      <Text $variation="1000" $size="xs">
        {user.full_name || user.email}
      </Text>
      <Button
        color="tertiary-text"
        size="nano"
        onClick={() => onRemoveUser?.(user)}
        icon={<Icon $variation="600" $size="sm" iconName="close" />}
      />
    </Box>
  );
};
