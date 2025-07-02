import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  DropdownMenu,
  DropdownMenuOption,
  Icon,
  IconOptions,
  LoadMoreText,
  Text,
} from '@/components';
import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, KEY_SUB_PAGE, Role } from '@/docs/doc-management';
import { User } from '@/features/auth';

import {
  useDeleteDocInvitation,
  useDocInvitationsInfinite,
  useUpdateDocInvitation,
} from '../api';
import { Invitation } from '../types';

import { DocRoleDropdown } from './DocRoleDropdown';
import { SearchUserRow } from './SearchUserRow';

type DocShareInvitationItemProps = {
  doc: Doc;
  invitation: Invitation;
};

export const DocShareInvitationItem = ({
  doc,
  invitation,
}: DocShareInvitationItemProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { spacingsTokens } = useCunninghamTheme();
  const invitedUser: User = {
    id: invitation.email,
    full_name: invitation.email,
    email: invitation.email,
    short_name: invitation.email,
    language: 'en-us',
  };

  const { toast } = useToastProvider();
  const canUpdate = doc.abilities.accesses_manage;

  const { mutate: updateDocInvitation } = useUpdateDocInvitation({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_SUB_PAGE, { id: doc.id }],
      });
    },
    onError: (error) => {
      toast(
        error?.data?.role?.[0] ?? t('Error during update invitation'),
        VariantType.ERROR,
        {
          duration: 4000,
        },
      );
    },
  });

  const { mutate: removeDocInvitation } = useDeleteDocInvitation({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_SUB_PAGE, { id: doc.id }],
      });
    },
    onError: (error) => {
      toast(
        error?.data?.role?.[0] ?? t('Error during delete invitation'),
        VariantType.ERROR,
        {
          duration: 4000,
        },
      );
    },
  });

  const onUpdate = (newRole: Role) => {
    updateDocInvitation({
      docId: doc.id,
      role: newRole,
      invitationId: invitation.id,
    });
  };

  const onRemove = () => {
    removeDocInvitation({ invitationId: invitation.id, docId: doc.id });
  };

  const moreActions: DropdownMenuOption[] = [
    {
      label: t('Delete'),
      icon: 'delete',
      callback: onRemove,
      disabled: !canUpdate,
    },
  ];

  return (
    <Box
      $width="100%"
      data-testid={`doc-share-invitation-row-${invitation.email}`}
      className="--docs--doc-share-invitation-item"
    >
      <SearchUserRow
        isInvitation={true}
        alwaysShowRight={true}
        user={invitedUser}
        right={
          <Box $direction="row" $align="center" $gap={spacingsTokens['2xs']}>
            <DocRoleDropdown
              currentRole={invitation.role}
              onSelectRole={onUpdate}
              canUpdate={canUpdate}
              doc={doc}
              access={invitation}
            />

            {canUpdate && (
              <DropdownMenu
                data-testid="doc-share-invitation-more-actions"
                options={moreActions}
              >
                <IconOptions isHorizontal $variation="600" />
              </DropdownMenu>
            )}
          </Box>
        }
      />
    </Box>
  );
};

type DocShareModalInviteUserRowProps = {
  user: User;
};
export const DocShareModalInviteUserRow = ({
  user,
}: DocShareModalInviteUserRowProps) => {
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

interface QuickSearchGroupInvitationProps {
  doc: Doc;
}

export const QuickSearchGroupInvitation = ({
  doc,
}: QuickSearchGroupInvitationProps) => {
  const { t } = useTranslation();
  const { data, hasNextPage, fetchNextPage } = useDocInvitationsInfinite({
    docId: doc.id,
  });

  const invitationsData: QuickSearchData<Invitation> = useMemo(() => {
    const invitations = data?.pages.flatMap((page) => page.results) || [];

    return {
      groupName: t('Pending invitations'),
      elements: invitations,
      endActions: hasNextPage
        ? [
            {
              content: <LoadMoreText data-testid="load-more-invitations" />,
              onSelect: () => void fetchNextPage(),
            },
          ]
        : undefined,
    };
  }, [data?.pages, fetchNextPage, hasNextPage, t]);

  if (!invitationsData.elements.length) {
    return null;
  }

  return (
    <Box aria-label={t('List invitation card')}>
      <QuickSearchGroup
        group={invitationsData}
        renderElement={(invitation) => (
          <DocShareInvitationItem doc={doc} invitation={invitation} />
        )}
      />
    </Box>
  );
};
