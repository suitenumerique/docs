import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { User } from '@/features/auth';

type Props = {
  user: User;
  onRemoveUser?: (user: User) => void;
};
export const DocShareAddMemberListItem = ({ user, onRemoveUser }: Props) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();

  return (
    <Box
      className="--docs--doc-share-add-member-list-item"
      data-testid={`doc-share-add-member-${user.email}`}
      $radius={spacingsTokens['3xs']}
      $direction="row"
      $height="fit-content"
      $justify="center"
      $align="center"
      $gap={spacingsTokens['3xs']}
      $padding={{
        left: spacingsTokens['xs'],
        right: spacingsTokens['4xs'],
        vertical: spacingsTokens['4xs'],
      }}
      $withThemeBG
      $theme="neutral"
      $variation="secondary"
    >
      <Text $withThemeInherited $size="xs">
        {user.full_name || user.email}
      </Text>
      <BoxButton
        onClick={() => onRemoveUser?.(user)}
        aria-label={t('Remove {{name}} from the invite list', {
          name: user.full_name || user.email,
        })}
        $withThemeInherited
      >
        <Icon $withThemeInherited $size="sm" iconName="close" />
      </BoxButton>
    </Box>
  );
};
