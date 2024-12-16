import { Modal, ModalSize } from '@openfun/cunningham-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import { Box } from '@/components';
import { LoadMoreText } from '@/components/LoadMoreText';
import {
  QuickSearch,
  QuickSearchData,
} from '@/components/quick-search/QuickSearch';
import { QuickSearchGroup } from '@/components/quick-search/QuickSearchGroup';
import { User } from '@/core';
import { Access, Doc } from '@/features/docs';
import {
  KEY_LIST_USER,
  useDocAccessesInfinite,
  useDocInvitationsInfinite,
  useUsers,
} from '@/features/docs/doc-share';
import { Invitation } from '@/features/docs/doc-share/types';
import { useResponsiveStore } from '@/stores';
import { isValidEmail } from '@/utils';

import { DocShareAddMemberList } from './DocShareAddMemberList';
import { DocShareInvitationItem } from './DocShareInvitationItem';
import { DocShareMemberItem } from './DocShareMemberItem';
import { DocShareModalFooter } from './DocShareModalFooter';
import { DocShareModalInviteUserRow } from './DocShareModalInviteUserByEmail';

type Props = {
  doc: Doc;
  onClose: () => void;
};
export const DocShareModal = ({ doc, onClose }: Props) => {
  const { t } = useTranslation();

  const { isDesktop } = useResponsiveStore();

  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const canShare = doc.abilities.accesses_manage;
  const showMemberSection = inputValue === '' && selectedUsers.length === 0;

  const onSelect = (user: User) => {
    setSelectedUsers((prev) => [...prev, user]);
    setUserQuery('');
    setInputValue('');
  };

  const membersQuery = useDocAccessesInfinite({
    docId: doc.id,
  });

  const invitationQuery = useDocInvitationsInfinite({
    docId: doc.id,
  });

  const searchUsersQuery = useUsers(
    { query: userQuery, docId: doc.id },
    {
      enabled: !!userQuery,
      queryKey: [KEY_LIST_USER, { query: userQuery }],
    },
  );

  const membersData: QuickSearchData<Access> = useMemo(() => {
    const members =
      membersQuery.data?.pages.flatMap((page) => page.results) || [];

    const count = membersQuery.data?.pages[0]?.count ?? 1;

    return {
      groupName: t('Share with {{count}} users', {
        count: count,
      }),
      elements: members,
      endActions: membersQuery.hasNextPage
        ? [
            {
              content: <LoadMoreText data-testid="load-more-members" />,
              onSelect: () => void membersQuery.fetchNextPage(),
            },
          ]
        : undefined,
    };
  }, [membersQuery, t]);

  const invitationsData: QuickSearchData<Invitation> = useMemo(() => {
    const invitations =
      invitationQuery.data?.pages.flatMap((page) => page.results) || [];

    return {
      groupName: t('Pending invitations'),
      elements: invitations,
      endActions: invitationQuery.hasNextPage
        ? [
            {
              content: <LoadMoreText data-testid="load-more-invitations" />,
              onSelect: () => void invitationQuery.fetchNextPage(),
            },
          ]
        : undefined,
    };
  }, [invitationQuery, t]);

  const searchUserData: QuickSearchData<User> = useMemo(() => {
    const users = searchUsersQuery.data?.results || [];
    const isEmail = isValidEmail(userQuery);
    const newUser: User = {
      id: userQuery,
      full_name: '',
      email: userQuery,
      short_name: '',
    };

    return {
      groupName: t('Search user result', { count: users.length }),
      elements: users,
      endActions:
        isEmail && users.length === 0
          ? [
              {
                content: <DocShareModalInviteUserRow user={newUser} />,
                onSelect: () => void onSelect(newUser),
              },
            ]
          : undefined,
    };
  }, [searchUsersQuery.data, t, userQuery]);

  const onFilter = useDebouncedCallback((str: string) => {
    setUserQuery(str);
  }, 300);

  const onRemoveUser = (row: User) => {
    setSelectedUsers((prevState) => {
      const index = prevState.findIndex((value) => value.id === row.id);
      if (index < 0) {
        return prevState;
      }
      const newArray = [...prevState];
      newArray.splice(index, 1);
      return newArray;
    });
  };

  return (
    <Modal
      isOpen
      closeOnClickOutside
      data-testid="doc-share-modal"
      aria-label={t('Share modal')}
      size={isDesktop ? ModalSize.LARGE : ModalSize.FULL}
      onClose={onClose}
      title={<Box $align="flex-start">{t('Share the document')}</Box>}
    >
      <Box
        aria-label={t('Share modal')}
        $direction="column"
        $justify="space-between"
      >
        <Box
          $flex={1}
          className="toto"
          $css={css`
            overflow-y: auto;
            [cmdk-list] {
              overflow-y: auto;
              height: ${isDesktop
                ? '400px'
                : 'calc(100vh - 49px -  68px - 237px)'};
            }
          `}
        >
          {canShare && selectedUsers.length > 0 && (
            <Box
              $padding={{ horizontal: 'base' }}
              $margin={{ vertical: '11px' }}
            >
              <DocShareAddMemberList
                doc={doc}
                selectedUsers={selectedUsers}
                onRemoveUser={onRemoveUser}
                afterInvite={() => {
                  setUserQuery('');
                  setInputValue('');
                  setSelectedUsers([]);
                }}
              />
            </Box>
          )}

          <Box data-testid="doc-share-quick-search">
            <QuickSearch
              onFilter={(str) => {
                setInputValue(str);
                onFilter(str);
              }}
              inputValue={inputValue}
              showInput={canShare}
              loading={searchUsersQuery.isLoading}
              placeholder={t('Type a name or email')}
            >
              {!showMemberSection && inputValue !== '' && (
                <QuickSearchGroup
                  group={searchUserData}
                  onSelect={onSelect}
                  renderElement={(user) => (
                    <DocShareModalInviteUserRow user={user} />
                  )}
                />
              )}
              {showMemberSection && (
                <>
                  {invitationsData.elements.length > 0 && (
                    <Box aria-label={t('List invitation card')}>
                      <QuickSearchGroup
                        group={invitationsData}
                        renderElement={(invitation) => (
                          <DocShareInvitationItem
                            doc={doc}
                            invitation={invitation}
                          />
                        )}
                      />
                    </Box>
                  )}

                  <Box aria-label={t('List members card')}>
                    <QuickSearchGroup
                      group={membersData}
                      renderElement={(access) => (
                        <DocShareMemberItem doc={doc} access={access} />
                      )}
                    />
                  </Box>
                </>
              )}
            </QuickSearch>
          </Box>
        </Box>
        {selectedUsers.length === 0 && !inputValue && (
          <DocShareModalFooter doc={doc} onClose={onClose} />
        )}
      </Box>
    </Modal>
  );
};
