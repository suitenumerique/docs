import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { User } from '@/features/auth';

import { SearchUserRow } from './SearchUserRow';

type Props = {
  user: User;
};
export const DocShareModalInviteUserRow = ({ user }: Props) => {
  const { t } = useTranslation();
  return (
    <Box
      $width="100%"
      data-testid={`search-user-row-${user.email}`}
      className="--docs--doc-share-modal-invite-user-row"
    >
      <SearchUserRow
        user={user}
        right={
          <Box
            className="right-hover"
            $direction="row"
            $align="center"
            $css={css`
              font-family: Arial, Helvetica, sans-serif;
              font-size: var(--c--theme--font--sizes--sm);
              color: var(--c--theme--colors--greyscale-400);
            `}
          >
            <Text $theme="primary" $variation="800">
              {t('Add')}
            </Text>
            <Icon $theme="primary" $variation="800" iconName="add" />
          </Box>
        }
      />
    </Box>
  );
};
