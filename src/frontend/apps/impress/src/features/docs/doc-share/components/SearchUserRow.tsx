import { Box, Text } from '@/components';
import {
  QuickSearchItemContent,
  QuickSearchItemContentProps,
} from '@/components/quick-search';
import { useCunninghamTheme } from '@/cunningham';
import { User } from '@/features/auth';

import { UserAvatar } from './UserAvatar';

type Props = {
  user: User;
  alwaysShowRight?: boolean;
  right?: QuickSearchItemContentProps['right'];
  isInvitation?: boolean;
};

export const SearchUserRow = ({
  user,
  right,
  alwaysShowRight = false,
  isInvitation = false,
}: Props) => {
  const hasFullName = user.full_name != null && user.full_name !== '';
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const spacings = spacingsTokens();
  const colors = colorsTokens();

  return (
    <QuickSearchItemContent
      right={right}
      alwaysShowRight={alwaysShowRight}
      left={
        <Box
          $direction="row"
          $align="center"
          $gap={spacings['xs']}
          className="--docs--search-user-row"
        >
          <UserAvatar
            user={user}
            background={isInvitation ? colors['greyscale-400'] : undefined}
          />
          <Box $direction="column">
            <Text $size="sm" $weight="500" $variation="1000">
              {hasFullName ? user.full_name : user.email}
            </Text>
            {hasFullName && (
              <Text $size="xs" $margin={{ top: '-2px' }} $variation="600">
                {user.email}
              </Text>
            )}
          </Box>
        </Box>
      }
    />
  );
};
