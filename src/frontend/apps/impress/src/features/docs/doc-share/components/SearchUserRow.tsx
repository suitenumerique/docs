import { Badge } from '@gouvfr-lasuite/ui-kit';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import {
  QuickSearchItemContent,
  QuickSearchItemContentProps,
} from '@/components/quick-search';
import { useCunninghamTheme } from '@/cunningham';
import { useKeyFingerprint } from '@/docs/doc-collaboration';
import { User, UserAvatar } from '@/features/auth';

type Props = {
  user: User;
  alwaysShowRight?: boolean;
  right?: QuickSearchItemContentProps['right'];
  isInvitation?: boolean;
  suffix?: string;
  onSuffixClick?: () => void;
  fingerprintKey?: string | null;
};

export const SearchUserRow = ({
  user,
  right,
  alwaysShowRight = false,
  isInvitation = false,
  suffix,
  onSuffixClick,
  fingerprintKey,
}: Props) => {
  const hasFullName = !!user.full_name;
  const { t } = useTranslation();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const fingerprint = useKeyFingerprint(fingerprintKey);

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
                <Text
                  $size="xs"
                  $weight="600"
                  $color={colorsTokens['warning-600']}
                  {...(onSuffixClick && {
                    onClick: (e: React.MouseEvent) => {
                      e.stopPropagation();
                      onSuffixClick();
                    },
                    role: 'button',
                    tabIndex: 0,
                    style: {
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    },
                  })}
                >
                  {suffix}
                </Text>
              )}
            </Box>
            {hasFullName && (
              <Text $size="xs" $margin={{ top: '-2px' }} $variation="secondary">
                {user.email}
              </Text>
            )}
            {fingerprint && (
              <Badge
                style={{ width: 'fit-content', gap: '0.3rem', margin: '5px 0' }}
              >
                <Text
                  $size="xs"
                  $weight="600"
                  $variation="secondary"
                  style={{ fontSize: '10px' }}
                >
                  {t('Fingerprint')}{' '}
                </Text>
                <Text
                  $size="xs"
                  style={{
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                    fontSize: '10px',
                  }}
                >
                  {fingerprint}
                </Text>
              </Badge>
            )}
          </Box>
        </Box>
      }
    />
  );
};
