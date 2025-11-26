import { Box, Text } from '@/components';
import {
  QuickSearchItemContent,
  QuickSearchItemContentProps,
} from '@/components/quick-search';
import { useCunninghamTheme } from '@/cunningham';
import { User, UserAvatar } from '@/features/auth';

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
  const hasFullName = !!user.full_name;
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();

  return (
    <QuickSearchItemContent
      right={right}
      alwaysShowRight={alwaysShowRight}
      left={
        <Box
          $direction="row"
          $align="center"
          $gap={spacingsTokens['xs']}
          className="--docs--search-user-row"
        >
          <UserAvatar
            fullName={user.full_name || user.email}
            background={isInvitation ? colorsTokens['gray-400'] : undefined}
          />
          <Box $direction="column">
            <Text $size="sm" $weight="500">
              {hasFullName ? user.full_name : user.email}
            </Text>
            {hasFullName && (
              <Text $size="xs" $margin={{ top: '-2px' }} $variation="secondary">
                {user.email}
              </Text>
            )}
          </Box>
        </Box>
      }
    />
  );
};
