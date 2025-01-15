import { Button } from '@openfun/cunningham-react';
import { useMemo } from 'react';

import { Box, Icon } from '@/components';

import { Doc, LinkReach } from '../../doc-management';

type Props = {
  doc: Doc;
  handleClick: () => void;
};
export const DocsGridItemSharedButton = ({ doc, handleClick }: Props) => {
  const isPublic = doc.link_reach === LinkReach.PUBLIC;
  const isAuthenticated = doc.link_reach === LinkReach.AUTHENTICATED;
  const isRestricted = doc.link_reach === LinkReach.RESTRICTED;
  const sharedCount = doc.nb_accesses - 1;
  const isShared = sharedCount > 0;

  const icon = useMemo(() => {
    if (isPublic) {
      return 'public';
    }
    if (isAuthenticated) {
      return 'corporate_fare';
    }
    if (isRestricted) {
      return 'group';
    }

    return undefined;
  }, [isPublic, isAuthenticated, isRestricted]);

  if (!icon) {
    return null;
  }

  if (!doc.abilities.accesses_view) {
    return (
      <Box $align="center" $width="100%">
        <Icon $variation="800" $theme="primary" iconName={icon} />
      </Box>
    );
  }

  return (
    <Button
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        handleClick();
      }}
      fullWidth
      color={isRestricted ? 'tertiary' : 'primary'}
      size="nano"
      icon={
        <Icon
          $variation={isRestricted ? '800' : '000'}
          $theme={isRestricted ? 'primary' : 'greyscale'}
          iconName={icon}
        />
      }
    >
      {isShared ? sharedCount : undefined}
    </Button>
  );
};
