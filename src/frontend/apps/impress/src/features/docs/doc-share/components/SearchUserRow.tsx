import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Icon, Text } from '@/components';
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
  /** A short status ("No encryption") shown as an icon with the text as tooltip. */
  suffix?: string;
  /** Material icon for the suffix; the crossed shield by default. */
  suffixIcon?: string;
  /** Makes the avatar a button (the person's encryption identity). */
  onAvatarClick?: () => void;
};

export const SearchUserRow = ({
  user,
  right,
  alwaysShowRight = false,
  isInvitation = false,
  suffix,
  suffixIcon = 'gpp_bad',
  onAvatarClick,
}: Props) => {
  const { t } = useTranslation();
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
          {onAvatarClick ? (
            <BoxButton
              aria-label={t('Verify the identity of {{name}}', {
                name: user.full_name || user.email,
              })}
              title={t('Verify the identity of {{name}}', {
                name: user.full_name || user.email,
              })}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onAvatarClick();
              }}
            >
              <UserAvatar
                fullName={user.full_name || user.email}
                background={isInvitation ? colorsTokens['gray-400'] : undefined}
              />
            </BoxButton>
          ) : (
            <UserAvatar
              fullName={user.full_name || user.email}
              background={isInvitation ? colorsTokens['gray-400'] : undefined}
            />
          )}
          <Box $direction="column">
            <Box $direction="row" $align="center" $gap={spacingsTokens['3xs']}>
              <Text $size="sm" $weight="500">
                {hasFullName ? user.full_name : user.email}
              </Text>
              {suffix && (
                <Icon
                  iconName={suffixIcon}
                  $size="sm"
                  $theme="neutral"
                  $variation="tertiary"
                  aria-label={suffix}
                  title={suffix}
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
