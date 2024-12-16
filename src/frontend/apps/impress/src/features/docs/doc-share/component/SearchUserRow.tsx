import { Box, Text } from '@/components';
import {
  QuickSearchItemContent,
  QuickSearchItemContentProps,
} from '@/components/quick-search/QuickSearchItemContent';
import { User } from '@/core';
import { useCunninghamTheme } from '@/cunningham';

import { UserAvatar } from './UserAvatar';

type Props = {
  user: User;
  alwaysShowRight?: boolean;
  right?: QuickSearchItemContentProps['right'];
};

export const SearchUserRow = ({
  user,
  right,
  alwaysShowRight = false,
}: Props) => {
  const hasFullName = user.full_name != null && user.full_name !== '';
  const { spacingsTokens } = useCunninghamTheme();
  const spacings = spacingsTokens();

  return (
    <QuickSearchItemContent
      right={right}
      alwaysShowRight={alwaysShowRight}
      left={
        <Box $direction="row" $align="center" $gap={spacings['2xs']}>
          <UserAvatar user={user} />
          <Box $direction="column">
            <Text $size="sm" $weight="500" $variation="1000">
              {hasFullName ? user.full_name : user.email}
            </Text>
            {hasFullName && (
              <Text $size="xs" $variation="600">
                {user.email}
              </Text>
            )}
          </Box>
        </Box>
      }
    />
  );
};
