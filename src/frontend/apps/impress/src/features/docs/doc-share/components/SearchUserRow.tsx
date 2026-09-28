import { Tooltip } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Icon, Text } from '@/components';
import {
  QuickSearchItemContent,
  QuickSearchItemContentProps,
} from '@/components/quick-search';
import { useCunninghamTheme } from '@/cunningham';
import { User, UserAvatar } from '@/features/auth';

export type UserRowStatus = {
  label: string;
  hint: string;
  /** Material icon; the crossed shield by default. */
  icon?: string;
};

type Props = {
  user: User;
  alwaysShowRight?: boolean;
  right?: QuickSearchItemContentProps['right'];
  isInvitation?: boolean;
  /** A short status next to the name, with a sentence explaining it on hover. */
  suffix?: UserRowStatus;
  /** Makes the avatar a button (the person's encryption identity). */
  onAvatarClick?: () => void;
};

export const SearchUserRow = ({
  user,
  right,
  alwaysShowRight = false,
  isInvitation = false,
  suffix,
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
                <Tooltip
                  content={<Text $textAlign="center">{suffix.hint}</Text>}
                  placement="top"
                >
                  <Box
                    $direction="row"
                    $align="center"
                    $gap="4xs"
                    aria-label={`${suffix.label}. ${suffix.hint}`}
                  >
                    <Icon
                      iconName={suffix.icon ?? 'gpp_bad'}
                      $size="14px"
                      $theme="neutral"
                      $variation="tertiary"
                    />
                    <Text
                      $size="xs"
                      $weight="500"
                      $theme="neutral"
                      $variation="tertiary"
                      $css="white-space: nowrap;"
                    >
                      {suffix.label}
                    </Text>
                  </Box>
                </Tooltip>
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
