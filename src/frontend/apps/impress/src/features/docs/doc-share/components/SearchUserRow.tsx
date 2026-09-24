import { Box, Icon, Text } from '@/components';
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
  /** A short status ("Verify key", "No encryption") shown as an icon with the text as tooltip. */
  suffix?: string;
  /** Material icon for the suffix; the shield-with-question mark by default. */
  suffixIcon?: string;
  onSuffixClick?: () => void;
};

export const SearchUserRow = ({
  user,
  right,
  alwaysShowRight = false,
  isInvitation = false,
  suffix,
  suffixIcon = 'gpp_maybe',
  onSuffixClick,
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
                <Icon
                  iconName={suffixIcon}
                  $size="sm"
                  $theme={onSuffixClick ? 'warning' : 'neutral'}
                  $variation={onSuffixClick ? undefined : 'tertiary'}
                  aria-label={suffix}
                  title={suffix}
                  {...(onSuffixClick && {
                    onClick: (e: React.MouseEvent) => {
                      e.stopPropagation();
                      onSuffixClick();
                    },
                    role: 'button',
                    tabIndex: 0,
                    style: { cursor: 'pointer' },
                  })}
                />
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
