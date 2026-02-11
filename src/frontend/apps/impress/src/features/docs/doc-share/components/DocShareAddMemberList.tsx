import {
  Button,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { APIError } from '@/api';
import { Box, Card } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { encryptSymmetricKey } from '@/docs/doc-collaboration';
import { toBase64 } from '@/docs/doc-editor';
import { Doc, Role } from '@/docs/doc-management';
import { User } from '@/features/auth';

import { useCreateDocAccess, useCreateDocInvitation } from '../api';
import { OptionType } from '../types';

import { DocRoleDropdown } from './DocRoleDropdown';
import { DocShareAddMemberListItem } from './DocShareAddMemberListItem';

type APIErrorUser = APIError<{
  value: string;
  type: OptionType;
}>;

type Props = {
  doc: Doc;
  documentEncryptionSettings: {
    documentSymmetricKey: CryptoKey;
  } | null;
  selectedUsers: User[];
  onRemoveUser?: (user: User) => void;
  onSubmit?: (selectedUsers: User[], role: Role) => void;
  afterInvite?: () => void;
};
export const DocShareAddMemberList = ({
  doc,
  documentEncryptionSettings,
  selectedUsers,
  onRemoveUser,
  afterInvite,
}: Props) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();

  const [isLoading, setIsLoading] = useState(false);
  const { spacingsTokens } = useCunninghamTheme();
  const [invitationRole, setInvitationRole] = useState<Role>(Role.EDITOR);
  const canShare = doc.abilities.accesses_manage;
  const { mutateAsync: createInvitation } = useCreateDocInvitation();
  const { mutateAsync: createDocAccess } = useCreateDocAccess();

  const onError = (dataError: APIErrorUser) => {
    let messageError =
      dataError['data']?.type === OptionType.INVITATION
        ? t(`Failed to create the invitation for {{email}}.`, {
            email: dataError['data']?.value,
          })
        : t(`Failed to add the member in the document.`);

    if (
      dataError.cause?.[0] ===
      'Document invitation with this Email address and Document already exists.'
    ) {
      messageError = t('"{{email}}" is already invited to the document.', {
        email: dataError['data']?.value,
      });
    }

    if (
      dataError.cause?.[0] ===
      'This email is already associated to a registered user.'
    ) {
      messageError = t('"{{email}}" is already member of the document.', {
        email: dataError['data']?.value,
      });
    }

    toast(messageError, VariantType.ERROR, {
      duration: 4000,
    });
  };

  const onInvite = async () => {
    setIsLoading(true);

    const promises = selectedUsers.map(async (user) => {
      const isInvitationMode = user.id === user.email;

      const payload = {
        role: invitationRole,
        docId: doc.id,
      };

      if (isInvitationMode) {
        return createInvitation({
          ...payload,
          email: user.email.toLowerCase(),
        });
      }

      // For encrypted docs, encrypt the symmetric key with the user's public key
      let memberEncryptedSymmetricKey: string | null = null;

      if (
        doc.is_encrypted &&
        documentEncryptionSettings &&
        user.encryption_public_key
      ) {
        const publicKeyBuffer = Uint8Array.from(
          atob(user.encryption_public_key),
          (c) => c.charCodeAt(0),
        ).buffer;

        const importedPublicKey = await crypto.subtle.importKey(
          'spki',
          publicKeyBuffer,
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          true,
          ['encrypt'],
        );

        const encryptedKey = await encryptSymmetricKey(
          documentEncryptionSettings.documentSymmetricKey,
          importedPublicKey,
        );

        memberEncryptedSymmetricKey = toBase64(new Uint8Array(encryptedKey));
      }

      return createDocAccess({
        ...payload,
        memberId: user.id,
        memberEncryptedSymmetricKey,
      });
    });

    const settledPromises = await Promise.allSettled(promises);
    settledPromises.forEach((settledPromise) => {
      if (settledPromise.status === 'rejected') {
        onError(settledPromise.reason as APIErrorUser);
      }
    });
    afterInvite?.();
    setIsLoading(false);
  };
  const inviteLabel =
    selectedUsers.length === 1
      ? t('Invite {{name}}', {
          name: selectedUsers[0].full_name || selectedUsers[0].email,
        })
      : t('Invite {{count}} members', { count: selectedUsers.length });

  return (
    <Card
      className="--docs--doc-share-add-member-list"
      data-testid="doc-share-add-member-list"
      $direction="row"
      $align="center"
      $padding={spacingsTokens.sm}
      $scope="surface"
      $theme="tertiary"
      $variation=""
      $border="1px solid var(--c--contextuals--border--semantic--contextual--primary)"
    >
      <Box
        $direction="row"
        $align="center"
        $wrap="wrap"
        $flex={1}
        $gap={spacingsTokens.xs}
      >
        {selectedUsers.map((user) => (
          <DocShareAddMemberListItem
            key={user.id}
            user={user}
            onRemoveUser={onRemoveUser}
          />
        ))}
      </Box>
      <Box $direction="row" $align="center" $gap={spacingsTokens.xs}>
        <DocRoleDropdown
          canUpdate={canShare}
          currentRole={invitationRole}
          onSelectRole={setInvitationRole}
          ariaLabel={t('Invite new members')}
        />
        <Button
          onClick={() => void onInvite()}
          disabled={isLoading}
          aria-label={inviteLabel}
          data-testid="doc-share-invite-button"
        >
          {t('Invite')}
        </Button>
      </Box>
    </Card>
  );
};
