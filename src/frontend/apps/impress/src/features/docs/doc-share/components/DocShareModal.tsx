import { Modal, ModalSize } from '@openfun/cunningham-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import { Box, HorizontalSeparator, Text } from '@/components';
import {
  QuickSearch,
  QuickSearchData,
  QuickSearchGroup,
} from '@/components/quick-search/';
import { User } from '@/features/auth';
import { Doc } from '@/features/docs';
import { useResponsiveStore } from '@/stores';
import { isValidEmail } from '@/utils';

import { KEY_LIST_USER, useUsers } from '../api';

import {
  ButtonAccessRequest,
  QuickSearchGroupAccessRequest,
} from './DocShareAccessRequest';
import { DocShareAddMemberList } from './DocShareAddMemberList';
import {
  DocShareModalInviteUserRow,
  QuickSearchGroupInvitation,
} from './DocShareInvitation';
import { QuickSearchGroupMember } from './DocShareMember';
import { DocShareModalFooter } from './DocShareModalFooter';

const ShareModalStyle = createGlobalStyle`
  .--docs--doc-share-modal [cmdk-item] {
    cursor: auto;
  }
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
  const canViewAccesses = doc.abilities.accesses_view;
  const showMemberSection = inputValue === '' && selectedUsers.length === 0;
  const showFooter = selectedUsers.length === 0 && !inputValue;
  const MIN_CHARACTERS_FOR_SEARCH = 4;

  const onSelect = (user: User) => {
    setSelectedUsers((prev) => [...prev, user]);
    setUserQuery('');
    setInputValue('');
  };

  const searchUsersQuery = useUsers(
    { query: userQuery, docId: doc.id },
    {
      enabled: userQuery?.length > MIN_CHARACTERS_FOR_SEARCH,
      queryKey: [KEY_LIST_USER, { query: userQuery }],
    },
  );

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
          $height={canViewAccesses ? modalContentHeight : 'auto'}
          $overflow="hidden"
          className="--docs--doc-share-modal noPadding "
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
            <Box ref={selectedUsersRef}>
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
              {!canViewAccesses && <HorizontalSeparator />}
            </Box>

            <Box data-testid="doc-share-quick-search">
              {!canViewAccesses && (
                <Box
                  $height={listHeight}
                  $align="center"
                  $justify="center"
                  $gap="1rem"
                >
                  <Text
                    $maxWidth="320px"
                    $textAlign="center"
                    $variation="600"
                    $size="sm"
                  >
                    {t(
                      'You do not have permission to view users sharing this document or modify link settings.',
                    )}
                  </Text>
                  <ButtonAccessRequest
                    docId={doc.id}
                    color="tertiary"
                    size="small"
                  />
                </Box>
              )}
              {canViewAccesses && (
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
                  {showMemberSection ? (
                    <>
                      <QuickSearchGroupAccessRequest doc={doc} />
                      <QuickSearchGroupInvitation doc={doc} />
                      <QuickSearchGroupMember doc={doc} />
                    </>
                  ) : (
                    <QuickSearchInviteInputSection
                      searchUsersRawData={searchUsersQuery.data}
                      onSelect={onSelect}
                      userQuery={userQuery}
                    />
                  )}
                </QuickSearch>
              )}
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

interface QuickSearchInviteInputSectionProps {
  onSelect: (usr: User) => void;
  searchUsersRawData: User[] | undefined;
  userQuery: string;
}

const QuickSearchInviteInputSection = ({
  onSelect,
  searchUsersRawData,
  userQuery,
}: QuickSearchInviteInputSectionProps) => {
  const { t } = useTranslation();

  const searchUserData: QuickSearchData<User> = useMemo(() => {
    const users = searchUsersRawData || [];
    const isEmail = isValidEmail(userQuery);
    const newUser: User = {
      id: userQuery,
      full_name: '',
      email: userQuery,
      short_name: '',
      language: '',
    };

    const hasEmailInUsers = users.some((user) => user.email === userQuery);

    return {
      groupName: t('Search user result'),
      elements: users,
      endActions:
        isEmail && !hasEmailInUsers
          ? [
              {
                content: <DocShareModalInviteUserRow user={newUser} />,
                onSelect: () => void onSelect(newUser),
              },
            ]
          : undefined,
    };
  }, [onSelect, searchUsersRawData, t, userQuery]);

  return (
    <QuickSearchGroup
      group={searchUserData}
      onSelect={onSelect}
      renderElement={(user) => <DocShareModalInviteUserRow user={user} />}
    />
  );
};
