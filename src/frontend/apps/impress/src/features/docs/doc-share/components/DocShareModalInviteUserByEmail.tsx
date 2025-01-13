import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { User } from '@/core';

import { SearchUserRow } from './SearchUserRow';

type Props = {
  user: User;
};
export const DocShareModalInviteUserRow = ({ user }: Props) => {
  const { t } = useTranslation();
  return (
    <Box $width="100%" data-testid={`search-user-row-${user.email}`}>
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
            <Text $theme="primary" $variation="600">
              {t('Add')}
            </Text>
            <Icon $theme="primary" $variation="600" iconName="add" />
          </Box>
        }
      />
    </Box>
  );
};
