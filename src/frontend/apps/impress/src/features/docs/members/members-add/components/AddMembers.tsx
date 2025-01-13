import {
  Button,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { APIError } from '@/api';
import { Box, Card, IconBG } from '@/components';
import { Doc, Role } from '@/features/docs/doc-management';
import { useCreateDocInvitation } from '@/features/docs/members/invitation-list/';
import { useLanguage } from '@/i18n/hooks/useLanguage';
import { useResponsiveStore } from '@/stores';

import { useCreateDocAccess } from '../api';
import {
  OptionInvitation,
  OptionNewMember,
  OptionSelect,
  OptionType,
  isOptionNewMember,
} from '../types';

import { ChooseRole } from './ChooseRole';
import { OptionsSelect, SearchUsers } from './SearchUsers';

type APIErrorUser = APIError<{
  value: string;
  type: OptionType;
}>;

interface ModalAddMembersProps {
  currentRole: Role;
  doc: Doc;
}

export const AddMembers = ({ currentRole, doc }: ModalAddMembersProps) => {
  const { contentLanguage } = useLanguage();
  const { t } = useTranslation();
  const { isSmallMobile } = useResponsiveStore();
  const [selectedUsers, setSelectedUsers] = useState<OptionsSelect>([]);
  const [selectedRole, setSelectedRole] = useState<Role>();
  const { toast } = useToastProvider();
  const { mutateAsync: createInvitation } = useCreateDocInvitation();
  const { mutateAsync: createDocAccess } = useCreateDocAccess();
  const [resetKey, setResetKey] = useState(1);

  const [isPending, setIsPending] = useState<boolean>(false);

  const switchActions = (selectedUsers: OptionsSelect, selectedRole: Role) =>
    selectedUsers.map(async (selectedUser) => {
      switch (selectedUser.type) {
        case OptionType.INVITATION:
          await createInvitation({
            email: selectedUser.value.email,
            role: selectedRole,
            docId: doc.id,
            contentLanguage,
          });
          break;

        case OptionType.NEW_MEMBER:
          await createDocAccess({
            role: selectedRole,
            docId: doc.id,
            memberId: selectedUser.value.id,
            contentLanguage,
          });
          break;
      }

      return selectedUser;
    });

  const toastOptions = {
    duration: 4000,
  };

  const onError = (dataError: APIErrorUser) => {
    let messageError =
      dataError['data']?.type === OptionType.INVITATION
        ? t(`Failed to create the invitation for {{email}}.`, {
            email: dataError['data']?.value,
          })
        : t(`Failed to add the member in the document.`);

 const onError = (dataError: APIErrorUser) => {
    const email = dataError['data']?.value;
    const statusCode = dataError.status; // Assuming `status` is available
    let messageError = t('An error occurred.');

    if (statusCode === 400) { // Bad Request
        messageError = email
            ? t(`Failed to create the invitation for {{email}}.`, { email })
            : t('Failed to add the member in the document.');
    } else if (statusCode === 409) { // Conflict
        if (dataError.cause?.some(cause => cause.includes('invitation') && cause.includes(email))) {
            messageError = t('"{{email}}" is already invited to the document.', { email });
        } else if (dataError.cause?.some(cause => cause.includes('associated to a registered user') && cause.includes(email))) {
            messageError = t('"{{email}}" is already a member of the document.', { email });
        }
    } else {
        messageError = t('An unexpected error occurred. Please try again.');
    }

    toast(messageError, VariantType.ERROR, toastOptions);
};


    toast(messageError, VariantType.ERROR, toastOptions);
  };

  const onSuccess = (option: OptionSelect) => {
    const message = !isOptionNewMember(option)
      ? t('Invitation sent to {{email}}.', {
          email: option.value.email,
        })
      : t('User {{email}} added to the document.', {
          email: option.value.email,
        });

    toast(message, VariantType.SUCCESS, toastOptions);
  };

  const handleValidate = async () => {
    setIsPending(true);

    if (!selectedRole) {
      return;
    }

    const settledPromises = await Promise.allSettled<
      OptionInvitation | OptionNewMember
    >(switchActions(selectedUsers, selectedRole));

    setIsPending(false);
    setResetKey(resetKey + 1);
    setSelectedUsers([]);
    setSelectedRole(undefined);

    settledPromises.forEach((settledPromise) => {
      switch (settledPromise.status) {
        case 'rejected':
          onError(settledPromise.reason as APIErrorUser);
          break;

        case 'fulfilled':
          onSuccess(settledPromise.value);
          break;
      }
    });
  };

  return (
    <Card
      $gap="1rem"
      $padding={{ horizontal: 'small', vertical: 'tiny' }}
      $margin="tiny"
      $direction="row"
      $align="center"
      $wrap="wrap"
    >
      <IconBG iconName="group_add" />
      <Box
        $gap="0.7rem"
        $direction="row"
        $wrap={isSmallMobile ? 'wrap' : 'nowrap'}
        $css="flex: 70%;"
      >
        <Box $gap="0.7rem" $direction="row" $wrap="wrap" $css="flex: 80%;">
          <Box $css="flex: auto;" $width="15rem">
            <SearchUsers
              key={resetKey}
              doc={doc}
              setSelectedUsers={setSelectedUsers}
              selectedUsers={selectedUsers}
              disabled={isPending || !doc.abilities.accesses_manage}
            />
          </Box>
          <Box $css="flex: auto;">
            <ChooseRole
              key={resetKey}
              currentRole={currentRole}
              disabled={isPending || !doc.abilities.accesses_manage}
              setRole={setSelectedRole}
            />
          </Box>
        </Box>
        <Box $align="center" $justify="center" $css="flex: auto;">
          <Button
            color="primary"
            disabled={
              !selectedUsers.length ||
              isPending ||
              !selectedRole ||
              !doc.abilities.accesses_manage
            }
            onClick={() => void handleValidate()}
            style={{ height: '100%', maxHeight: '55px' }}
          >
            {t('Validate')}
          </Button>
        </Box>
      </Box>
    </Card>
  );
};
