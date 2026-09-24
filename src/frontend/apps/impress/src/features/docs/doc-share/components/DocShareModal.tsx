import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import {
  Box,
  ButtonCloseModal,
  HorizontalSeparator,
  Loading,
  Text,
} from '@/components';
import {
  QuickSearch,
  QuickSearchData,
  QuickSearchGroup,
} from '@/components/quick-search/';
import {
  useDocumentEncryption,
  useUserEncryption,
} from '@/docs/doc-collaboration';
import type { DocumentEncryptionSettings } from '@/docs/doc-collaboration/hook/useDocumentEncryption';
import {
  fetchRegisteredKeys,
  useVaultClient,
} from '@/docs/doc-collaboration/vault';
import { Doc } from '@/docs/doc-management';
import { User, useAuth } from '@/features/auth';
import {
  EncryptionEmptyState,
  EncryptionModalContent,
} from '@/features/docs/doc-management/components/EncryptionLayout';
import { useResponsiveStore } from '@/stores';
import { isValidEmail } from '@/utils';

import {
  KEY_LIST_DOC_ACCESSES,
  KEY_LIST_DOC_ACCESS_REQUESTS,
  KEY_LIST_DOC_INVITATIONS,
  KEY_LIST_USER,
  useDocAccesses,
  useUsers,
} from '../api';

import { DocInheritedShareContent } from './DocInheritedShareContent';
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
import { PendingEncryptionSection } from './PendingEncryptionSection';

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
  documentEncryptionSettings?: DocumentEncryptionSettings | null;
  isRootDoc?: boolean;
  onClose: () => void;
};

export const DocShareModal = ({
  doc,
  documentEncryptionSettings,
  onClose,
  isRootDoc = true,
}: Props) => {
  const { t } = useTranslation();
  const selectedUsersRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { isDesktop } = useResponsiveStore();
  const { user } = useAuth();

  // When document encryption settings exist they should be passed as prop, on it will use this fallback
  // that's because in some cases we want them to only be computed at this step (to avoid computing just when listed in a list)
  const needsDerivation = !documentEncryptionSettings;
  const { encryptionLoading, encryptionError } = useUserEncryption();
  const {
    documentEncryptionLoading,
    documentEncryptionSettings: derivedEncryptionSettings,
    documentEncryptionError,
  } = useDocumentEncryption(
    needsDerivation ? doc.is_encrypted : undefined,
    needsDerivation ? doc.encrypted_document_symmetric_key_for_user : undefined,
    needsDerivation && user?.suite_user_id
      ? doc.accesses_versions_per_user?.[user.suite_user_id]
      : undefined,
  );
  const effectiveEncryptionSettings =
    documentEncryptionSettings ?? derivedEncryptionSettings ?? null;
  const isEncryptionDeriving =
    needsDerivation && (encryptionLoading || documentEncryptionLoading);
  const derivedEncryptionError =
    needsDerivation && doc.is_encrypted
      ? encryptionError || documentEncryptionError
      : null;

  /**
   * The modal content height is calculated based on the viewport height.
   * The formula is:
   * 100dvh - 2em - 12px - 34px
   * - 34px is the height of the modal title in mobile
   * - 2em is the padding of the modal content
   * - 12px is the padding of the modal footer
   * - 690px is the height of the content in desktop
   * This ensures that the modal content is always visible and does not overflow.
   */
  const modalContentHeight = isDesktop
    ? 'min(690px, calc(100dvh - 2em - 12px - 34px))'
    : `calc(100dvh - 34px)`;
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const [listHeight, setListHeight] = useState<string>('400px');
  const canShare = doc.abilities.accesses_manage && isRootDoc;
  const canViewAccesses = doc.abilities.accesses_view;
  const showMemberSection = inputValue === '' && selectedUsers.length === 0;
  const showFooter = selectedUsers.length === 0 && !inputValue;
  const MIN_CHARACTERS_FOR_SEARCH = 4;

  const onSelect = (user: User) => {
    setSelectedUsers((prev) => [...prev, user]);
    setUserQuery('');
    setInputValue('');

    // Announce to screen readers
    const userName = user.full_name || user.email;
    setLiveAnnouncement(
      t(
        '{{name}} added to invite list. Add more members or press Tab to select role and invite.',
        {
          name: userName,
        },
      ),
    );
    // Clear announcement after it's been read
    setTimeout(() => setLiveAnnouncement(''), 100);
  };

  const { data: membersQuery } = useDocAccesses({
    docId: doc.id,
  });

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

      // Announce to screen readers
      const userName = row.full_name || row.email;
      setLiveAnnouncement(
        t('{{name}} removed from invite list', {
          name: userName,
        }),
      );
      setTimeout(() => setLiveAnnouncement(''), 100);

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

  const inheritedAccesses = useMemo(() => {
    return (
      membersQuery?.filter((access) => access.document.id !== doc.id) ?? []
    );
  }, [membersQuery, doc.id]);

  const showInheritedShareContent =
    inheritedAccesses.length > 0 && showMemberSection && !isRootDoc;

  // Invalidate relevant queries to ensure fresh data on modal open
  useEffect(() => {
    [
      KEY_LIST_DOC_INVITATIONS,
      KEY_LIST_DOC_ACCESS_REQUESTS,
      KEY_LIST_DOC_ACCESSES,
    ].forEach((key) => {
      void queryClient.invalidateQueries({
        queryKey: [key],
      });
    });
  }, [queryClient]);

  return (
    <>
      <Modal
        isOpen
        closeOnClickOutside
        data-testid="doc-share-modal"
        aria-labelledby="doc-share-modal-title"
        size={isDesktop ? ModalSize.LARGE : ModalSize.FULL}
        aria-modal="true"
        onClose={onClose}
        title={
          <Box $direction="row" $justify="space-between" $align="center">
            <Text
              as="h1"
              id="doc-share-modal-title"
              $align="flex-start"
              $size="small"
              $weight="600"
              $margin="0"
            >
              {t('Share the document')}
            </Text>
            <ButtonCloseModal
              aria-label={t('Close the share modal')}
              onClick={onClose}
            />
          </Box>
        }
        hideCloseButton
      >
        <ShareModalStyle />
        {/* Screen reader announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveAnnouncement}
        </div>
        {isEncryptionDeriving && <Loading />}
        {!isEncryptionDeriving && derivedEncryptionError && (
          <EncryptionEmptyState
            title={t('Encrypted document')}
            description={
              encryptionError === 'missing_private_key' ||
              encryptionError === 'missing_public_key'
                ? t(
                    'This document is encrypted. You must enable encryption on your account to access it.',
                  )
                : documentEncryptionError === 'missing_symmetric_key'
                  ? t(
                      'You do not have access to this encrypted document. Ask the document owner to share it with you again.',
                    )
                  : t(
                      'You do not have the correct encryption key to decrypt this document. Ask the document owner to share it with you again.',
                    )
            }
          />
        )}
        {!isEncryptionDeriving && !derivedEncryptionError && (
          <Box
            $height="auto"
            $maxHeight={canViewAccesses ? modalContentHeight : 'none'}
            $overflow="hidden"
            className="--docs--doc-share-modal noPadding "
            $justify="space-between"
            role="dialog"
            aria-label={t('Share modal content')}
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
                    $margin={{ top: '12x' }}
                  >
                    <DocShareAddMemberList
                      doc={doc}
                      documentEncryptionSettings={effectiveEncryptionSettings}
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
                {!canViewAccesses && (
                  <HorizontalSeparator customPadding="12px" />
                )}
              </Box>

              {doc.is_encrypted && canShare && membersQuery && (
                <PendingEncryptionSection
                  doc={doc}
                  accesses={membersQuery}
                  documentEncryptionSettings={effectiveEncryptionSettings}
                />
              )}

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
                      $variation="secondary"
                      $size="sm"
                      as="p"
                    >
                      {t(
                        'You can view this document but need additional access to see its members or modify settings.',
                      )}
                    </Text>
                    <ButtonAccessRequest
                      docId={doc.id}
                      variant="secondary"
                      size="small"
                    />
                  </Box>
                )}
                {canViewAccesses && (
                  <QuickSearch
                    label={t('Search results')}
                    onFilter={(str) => {
                      setInputValue(str);
                      onFilter(str);
                    }}
                    inputValue={inputValue}
                    showInput={canShare}
                    loading={searchUsersQuery.isLoading}
                    placeholder={t('Type a name or email')}
                  >
                    {showInheritedShareContent && (
                      <DocInheritedShareContent
                        rawAccesses={
                          membersQuery?.filter(
                            (access) => access.document.id !== doc.id,
                          ) ?? []
                        }
                      />
                    )}
                    {showMemberSection && isRootDoc && (
                      <Box $padding={{ horizontal: 'base' }}>
                        <QuickSearchGroupAccessRequest doc={doc} />
                        <QuickSearchGroupInvitation doc={doc} />
                        <QuickSearchGroupMember doc={doc} />
                      </Box>
                    )}

                    {!showMemberSection && canShare && (
                      <QuickSearchInviteInputSection
                        searchUsersRawData={searchUsersQuery.data}
                        onSelect={onSelect}
                        userQuery={userQuery}
                        isEncrypted={doc.is_encrypted}
                      />
                    )}
                  </QuickSearch>
                )}
              </Box>
            </Box>

            <Box ref={handleRef}>
              {showFooter && (
                <DocShareModalFooter doc={doc} onClose={onClose} />
              )}
            </Box>
          </Box>
        )}
      </Modal>
    </>
  );
};

interface QuickSearchInviteInputSectionProps {
  onSelect: (usr: User) => void;
  searchUsersRawData: User[] | undefined;
  userQuery: string;
  isEncrypted: boolean;
}

const QuickSearchInviteInputSection = ({
  onSelect,
  searchUsersRawData,
  userQuery,
  isEncrypted,
}: QuickSearchInviteInputSectionProps) => {
  const { t } = useTranslation();
  const { client: vaultClient } = useVaultClient();
  const [showNoKeyModal, setShowNoKeyModal] = useState(false);
  // Subs of the search results that hold a registered encryption key, from
  // the directory; null until known (or when the lookup failed), in which
  // case nobody is refused here and the invitation itself reports.
  const [registeredSubs, setRegisteredSubs] = useState<Set<string> | null>(
    null,
  );

  useEffect(() => {
    if (!isEncrypted || !vaultClient) {
      setRegisteredSubs(null);
      return;
    }

    const subs = (searchUsersRawData ?? [])
      .map((user) => user.suite_user_id)
      .filter((sub): sub is string => !!sub);

    if (subs.length === 0) {
      setRegisteredSubs(new Set());
      return;
    }

    let cancelled = false;
    setRegisteredSubs(null);
    fetchRegisteredKeys(vaultClient, subs)
      .then(({ publicKeys }) => {
        if (!cancelled) {
          setRegisteredSubs(new Set(Object.keys(publicKeys)));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegisteredSubs(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEncrypted, vaultClient, searchUsersRawData]);

  const hasNoKey = useCallback(
    (user: User) =>
      isEncrypted &&
      (!user.suite_user_id ||
        (registeredSubs !== null && !registeredSubs.has(user.suite_user_id))),
    [isEncrypted, registeredSubs],
  );

  const showEncryptedInviteWarning = useMemo(() => {
    const users = searchUsersRawData || [];
    const isEmail = isValidEmail(userQuery);
    const hasEmailInUsers = users.some(
      (user) => user.email.toLowerCase() === userQuery.toLowerCase(),
    );
    return isEncrypted && isEmail && !hasEmailInUsers;
  }, [searchUsersRawData, userQuery, isEncrypted]);

  const handleSelect = useCallback(
    (user: User) => {
      if (hasNoKey(user)) {
        setShowNoKeyModal(true);
        return;
      }
      onSelect(user);
    },
    [hasNoKey, onSelect],
  );

  const searchUserData: QuickSearchData<User> = useMemo(() => {
    const users = searchUsersRawData || [];
    const isEmail = isValidEmail(userQuery);
    const newUser: User = {
      id: userQuery,
      suite_user_id: null,
      full_name: '',
      email: userQuery,
      short_name: '',
      language: '',
    };

    const hasEmailInUsers = users.some(
      (user) => user.email.toLowerCase() === userQuery.toLowerCase(),
    );

    const showInviteByEmail = isEmail && !hasEmailInUsers && !isEncrypted;

    return {
      groupName: t('Search user result'),
      elements: users,
      endActions: showInviteByEmail
        ? [
            {
              content: <DocShareModalInviteUserRow user={newUser} />,
              onSelect: () => void handleSelect(newUser),
            },
          ]
        : undefined,
    };
  }, [handleSelect, searchUsersRawData, t, userQuery, isEncrypted]);

  // On an encrypted document, a person's avatar opens their encryption
  // identity (fingerprint, trust decision), registered or not.
  const identityOf = (user: User): (() => void) | undefined => {
    const sub = user.suite_user_id;
    if (!isEncrypted || !vaultClient || !sub) {
      return undefined;
    }
    return () =>
      vaultClient.openRecipientProfile(sub, {
        email: user.email,
        name: user.full_name || undefined,
      });
  };

  const getUserSuffix = useCallback(
    (user: User): string | undefined => {
      if (hasNoKey(user)) {
        return t('No encryption');
      }
      return undefined;
    },
    [hasNoKey, t],
  );

  return (
    <Box
      aria-label={t('List search user result card')}
      $padding={{ horizontal: 'base', bottom: '3xs' }}
    >
      <QuickSearchGroup
        group={searchUserData}
        onSelect={handleSelect}
        renderElement={(user) => (
          <DocShareModalInviteUserRow
            user={user}
            suffix={getUserSuffix(user)}
            onAvatarClick={identityOf(user)}
          />
        )}
      />
      {showEncryptedInviteWarning && (
        <Text
          $variation="secondary"
          $size="sm"
          $padding={{ horizontal: 'xs', top: '3xs' }}
        >
          {t(
            'Only registered users with encryption enabled can be added to encrypted documents.',
          )}
        </Text>
      )}
      {showNoKeyModal && (
        <Modal
          isOpen
          closeOnClickOutside
          onClose={() => setShowNoKeyModal(false)}
          size={ModalSize.SMALL}
          aria-label={t('Encryption required')}
        >
          <EncryptionModalContent
            illustration="document-shield-x"
            title={t('Encryption required')}
            description={t(
              'This person has not enabled encryption yet, so the document cannot be shared with them. Ask them to enable encryption first.',
            )}
            actions={
              <Button fullWidth onClick={() => setShowNoKeyModal(false)}>
                {t('Understood')}
              </Button>
            }
          />
        </Modal>
      )}
    </Box>
  );
};
