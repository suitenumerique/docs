import { Button } from '@openfun/cunningham-react';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { User } from '@/core';
import { useCunninghamTheme } from '@/cunningham';

type Props = {
  user: User;
  onRemoveUser?: (user: User) => void;
};
export const DocShareAddMemberListItem = ({ user, onRemoveUser }: Props) => {
  const { spacingsTokens, colorsTokens, fontSizesTokens } =
    useCunninghamTheme();
  const spacing = spacingsTokens();
  const color = colorsTokens();
  const fontSize = fontSizesTokens();
  return (
    <Box
      data-testid={`doc-share-add-member-${user.email}`}
      $radius={spacing['3xs']}
      $direction="row"
      $height="fit-content"
      $justify="center"
      $align="center"
      $gap={spacing.xs}
      $background={color['greyscale-250']}
      $padding={{ horizontal: spacing['2xs'], vertical: spacing['3xs'] }}
      $css={css`
        color: ${color['greyscale-1000']};
        font-size: ${fontSize['xs']};
      `}
    >
      <Text $margin={{ top: '-3px' }}>{user.full_name || user.email}</Text>
      <Button
        color="primary-text"
        size="nano"
        onClick={() => onRemoveUser?.(user)}
        icon={<Icon $variation="500" $size="sm" iconName="close" />}
      />
    </Box>
  );
};
