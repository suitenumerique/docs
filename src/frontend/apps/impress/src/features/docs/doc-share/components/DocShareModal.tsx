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
  Icon,
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
  usePublicKeyRegistry,
  useUserEncryption,
} from '@/docs/doc-collaboration';
import type { PublicKeyMismatch } from '@/docs/doc-collaboration/hook/usePublicKeyRegistry';
import { Doc } from '@/docs/doc-management';
import { User, useAuth } from '@/features/auth';
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
import { ModalKeyMismatch } from './ModalKeyMismatch';

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
  documentEncryptionSettings?: {
    documentSymmetricKey: CryptoKey;
  } | null;
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
  );
  const effectiveEncryptionSettings =
    documentEncryptionSettings ?? derivedEncryptionSettings ?? null;
  const isEncryptionDeriving =
    needsDerivation && (encryptionLoading || documentEncryptionLoading);
  const derivedEncryptionError =
    needsDerivation && doc.is_encrypted
      ? encryptionError || documentEncryptionError
      : null;

  const { mismatches: keyMismatches, acceptNewKey } = usePublicKeyRegistry(
    doc.is_encrypted ? doc.accesses_public_keys_per_user : undefined,
    user?.id,
  );
  const keyMismatchUserIds = useMemo(
    () => new Set(keyMismatches.map((m) => m.userId)),
    [keyMismatches],
  );

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
          <Box $align="center" $gap="sm" $padding="lg">
            <Icon iconName="lock" $size="2rem" $theme="warning" />
            <Text as="h3" $textAlign="center" $margin="0">
              {t('Encryption keys unavailable')}
            </Text>
            <Text $variation="secondary" $textAlign="center" $size="sm">
              {t(
                'This is an encrypted document, but your current device does not have the required encryption keys to decrypt it.',
              )}
            </Text>
            {(encryptionError === 'missing_private_key' ||
              encryptionError === 'missing_public_key') && (
              <Text $variation="secondary" $textAlign="center" $size="sm">
                {t(
                  'This usually happens when you switch to a new device or browser without restoring your encryption backup, please go to your "Encryption Settings" to fix it.',
                )}
              </Text>
            )}
            {documentEncryptionError === 'missing_symmetric_key' && (
              <Text $variation="secondary" $textAlign="center" $size="sm">
                {t(
                  'You do not have access to this encrypted document. Ask the document owner to share it with you again.',
                )}
              </Text>
            )}
            {documentEncryptionError === 'decryption_failed' && (
              <Text $variation="secondary" $textAlign="center" $size="sm">
                {t(
                  'Your encryption keys could not decrypt this document. This may happen if your keys were recreated. Ask the document owner to share it with you again.',
                )}
              </Text>
            )}
          </Box>
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
                        <QuickSearchGroupMember
                          doc={doc}
                          keyMismatchUserIds={keyMismatchUserIds}
                          keyMismatches={keyMismatches}
                          acceptNewKey={acceptNewKey}
                        />
                      </Box>
                    )}

                    {!showMemberSection && canShare && (
                      <QuickSearchInviteInputSection
                        searchUsersRawData={searchUsersQuery.data}
                        onSelect={onSelect}
                        userQuery={userQuery}
                        isEncrypted={doc.is_encrypted}
                        keyMismatchUserIds={keyMismatchUserIds}
                        keyMismatches={keyMismatches}
                        acceptNewKey={acceptNewKey}
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
  keyMismatchUserIds?: Set<string>;
  keyMismatches?: PublicKeyMismatch[];
  acceptNewKey?: (userId: string) => Promise<void>;
}

const QuickSearchInviteInputSection = ({
  onSelect,
  searchUsersRawData,
  userQuery,
  isEncrypted,
  keyMismatchUserIds,
  keyMismatches,
  acceptNewKey,
}: QuickSearchInviteInputSectionProps) => {
  const { t } = useTranslation();
  const [showNoKeyModal, setShowNoKeyModal] = useState(false);
  const [mismatchUser, setMismatchUser] = useState<User | null>(null);

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
      if (isEncrypted && !user.encryption_public_key) {
        setShowNoKeyModal(true);
        return;
      }
      if (keyMismatchUserIds?.has(user.id)) {
        setMismatchUser(user);
        return;
      }
      onSelect(user);
    },
    [isEncrypted, keyMismatchUserIds, onSelect],
  );

  const searchUserData: QuickSearchData<User> = useMemo(() => {
    const users = searchUsersRawData || [];
    const isEmail = isValidEmail(userQuery);
    const newUser: User = {
      id: userQuery,
      full_name: '',
      email: userQuery,
      short_name: '',
      encryption_public_key: null,
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

  const getUserSuffix = useCallback(
    (user: User): string | undefined => {
      if (keyMismatchUserIds?.has(user.id)) {
        return t('DIFFERENT PUBLIC KEY, PLEASE VERIFY');
      }
      if (isEncrypted && !user.encryption_public_key) {
        return t(`(encryption not enabled)`);
      }
      return undefined;
    },
    [isEncrypted, keyMismatchUserIds, t],
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
            fingerprintKey={
              isEncrypted ? user.encryption_public_key : undefined
            }
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
          rightActions={
            <Button onClick={() => setShowNoKeyModal(false)}>
              {t('Understood')}
            </Button>
          }
          title={
            <Text
              as="h1"
              $gap="0.7rem"
              $size="h6"
              $align="flex-start"
              $direction="row"
              $margin="0"
            >
              <Icon iconName="lock" />
              {t('Encryption required')}
            </Text>
          }
        >
          <Box $direction="column" $gap="0.35rem" $margin={{ top: 'sm' }}>
            <Text $variation="secondary">
              {t(
                'This user has not enabled encryption on their account yet. It is not possible to share encrypted content with them.',
              )}
            </Text>
            <Text $variation="secondary">
              {t(
                'Please ask them to enable encryption in their account settings first.',
              )}
            </Text>
          </Box>
        </Modal>
      )}
      {mismatchUser &&
        (() => {
          const mismatch = keyMismatches?.find(
            (m) => m.userId === mismatchUser.id,
          );
          return (
            <ModalKeyMismatch
              onClose={() => setMismatchUser(null)}
              onAcceptKey={
                acceptNewKey
                  ? () => {
                      void acceptNewKey(mismatchUser.id).then(() => {
                        onSelect(mismatchUser);
                      });
                    }
                  : undefined
              }
              knownKey={mismatch?.knownKey}
              currentKey={mismatch?.currentKey}
            />
          );
        })()}
    </Box>
  );
};
