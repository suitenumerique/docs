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
  suffix?: string;
};

export const SearchUserRow = ({
  user,
  right,
  alwaysShowRight = false,
  isInvitation = false,
  suffix,
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
            <Box $direction="row" $align="center" $gap={spacingsTokens['3xs']}>
              <Text $size="sm" $weight="500">
                {hasFullName ? user.full_name : user.email}
              </Text>
              {suffix && (
                <Text $size="xs" $weight="600" $color={colorsTokens['warning-600']}>
                  {suffix}
                </Text>
              )}
            </Box>
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
