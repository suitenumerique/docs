import { useTranslation } from 'react-i18next';

import ArrowIcon from '@/assets/icons/ui-kit/keyboard_return.svg';
import { Box, Text } from '@/components';
import {
  QuickSearchGroup,
  QuickSearchItemContent,
} from '@/components/quick-search';
import { UserAvatar } from '@/features/auth';

import { MentionableUser, getMentionableUserName } from './useMentionableUsers';

type UserMentionSearchGroupProps = {
  users: MentionableUser[];
  onSelect: (user: MentionableUser) => void;
};

/**
 * Section of the search dropdown proposing the users to mention. It renders
 * nothing when there is no user to propose.
 */
export const UserMentionSearchGroup = ({
  users,
  onSelect,
}: UserMentionSearchGroupProps) => {
  const { t } = useTranslation();

  if (users.length === 0) {
    return null;
  }

  return (
    <QuickSearchGroup
      group={{
        groupName: t('Mention a person'),
        groupKey: 'users',
        elements: users,
      }}
      onSelect={onSelect}
      renderElement={(user) => {
        const name = getMentionableUserName(user);

        return (
          <QuickSearchItemContent
            left={
              <Box
                className="--docs--mention-user-item"
                $direction="row"
                $gap="0.8rem"
                $align="center"
                $padding={{ vertical: '0.5rem', horizontal: '0.2rem' }}
                $width="100%"
              >
                <UserAvatar fullName={name} />
                <Text
                  $size="sm"
                  $color="var(--c--contextuals--content--semantic--neutral--primary)"
                  spellCheck="false"
                  $weight="500"
                >
                  {name}
                </Text>
              </Box>
            }
            right={
              <ArrowIcon
                aria-hidden="true"
                width="24px"
                height="24px"
                color="var(--c--contextuals--content--semantic--neutral--tertiary)"
              />
            }
          />
        );
      }}
    />
  );
};
