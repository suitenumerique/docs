import { Modal, ModalSize } from '@openfun/cunningham-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import { Box, LoadMoreText } from '@/components';
import {
  QuickSearch,
  QuickSearchData,
  QuickSearchGroup,
} from '@/components/quick-search/';
import { User } from '@/core';
import { Access, Doc } from '@/features/docs';
import { useResponsiveStore } from '@/stores';
import { isValidEmail } from '@/utils';

import {
  KEY_LIST_USER,
  useDocAccessesInfinite,
  useDocInvitationsInfinite,
  useUsers,
} from '../api';
import { Invitation } from '../types';

import { DocShareAddMemberList } from './DocShareAddMemberList';
import { DocShareInvitationItem } from './DocShareInvitationItem';
import { DocShareMemberItem } from './DocShareMemberItem';
import { DocShareModalFooter } from './DocShareModalFooter';
import { DocShareModalInviteUserRow } from './DocShareModalInviteUserByEmail';

const ShareModalStyle = createGlobalStyle`

  .c__modal__title {
    padding-bottom: 0 !important;

}

`;

type Props = {
  doc: Doc;
  onClose: () => void;
};

export const DocShareModal = ({ doc, onClose }: Props) => {
  const { t } = useTranslation();
  const selectedUsersRef = useRef<HTMLDivElement>(null);

  const { isDesktop } = useResponsiveStore();

  const modalContentHeight = isDesktop
    ? 'min(690px, calc(100dvh - 2em - 12px - 34px))' // 100dvh - 2em - 12px  is the max cunningham modal height.  690px is the height of the content in desktop ad 34px is the height of the modal title in mobile
    : `calc(100dvh - 34px)`;
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [inputValue, setInputValue] = useState('');

  const [listHeight, setListHeight] = useState<string>('400px');
  const canShare = doc.abilities.accesses_manage;
  const showMemberSection = inputValue === '' && selectedUsers.length === 0;
  const showFooter = selectedUsers.length === 0 && !inputValue;

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
      groupName:
        count === 1
          ? t('Document owner')
          : t('Share with {{count}} users', {
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

  const handleRef = (node: HTMLDivElement) => {
    const inputHeight = canShare ? 70 : 0;
    const marginTop = 11;
    const footerHeight = node?.clientHeight ?? 0;
    const selectedUsersHeight = selectedUsersRef.current?.clientHeight ?? 0;
    const height = `calc(${modalContentHeight} - ${footerHeight}px - ${selectedUsersHeight}px - ${inputHeight}px - ${marginTop}px)`;

    setListHeight(height);
  };

  return (
    <>
      <Modal
        isOpen
        closeOnClickOutside
        data-testid="doc-share-modal"
        aria-label={t('Share modal')}
        size={isDesktop ? ModalSize.LARGE : ModalSize.FULL}
        onClose={onClose}
        title={<Box $align="flex-start">{t('Share the document')}</Box>}
      >
        <ShareModalStyle />
        <Box
          aria-label={t('Share modal')}
          $height={modalContentHeight}
          $overflow="hidden"
          $justify="space-between"
        >
          <Box
            $flex={1}
            $css={css`
              [cmdk-list] {
                overflow-y: auto;
                height: ${listHeight};
              }
            `}
          >
            <div ref={selectedUsersRef}>
              {canShare && selectedUsers.length > 0 && (
                <Box
                  $padding={{ horizontal: 'base' }}
                  $margin={{ top: '11px' }}
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
            </div>

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

          <Box ref={handleRef}>
            {showFooter && <DocShareModalFooter doc={doc} onClose={onClose} />}
          </Box>
        </Box>
      </Modal>
    </>
  );
};
