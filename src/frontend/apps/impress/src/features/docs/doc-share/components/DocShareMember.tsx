import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Access, Doc, KEY_SUB_PAGE, Role } from '@/docs/doc-management/';

import { useUpdateDocAccess } from '../api';
import { useWhoAmI } from '../hooks/';

import { DocRoleDropdown } from './DocRoleDropdown';
import { SearchUserRow } from './SearchUserRow';

type Props = {
  doc?: Doc;
  access: Access;
  isInherited?: boolean;
};
export const DocShareMemberItem = ({
  doc,
  access,
  isInherited = false,
}: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isLastOwner } = useWhoAmI(access);
  const { toast } = useToastProvider();

  const { spacingsTokens } = useCunninghamTheme();

  const message = isLastOwner
    ? t(
        'You are the sole owner of this group, make another member the group owner before you can change your own role or be removed from your document.',
      )
    : undefined;

  const { mutate: updateDocAccess } = useUpdateDocAccess({
    onSuccess: () => {
      if (!doc) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: [KEY_SUB_PAGE, { id: doc.id }],
      });
    },
    onError: () => {
      toast(t('Error while updating the member role.'), VariantType.ERROR, {
        duration: 4000,
      });
    },
  });

  const onUpdate = (newRole: Role) => {
    if (!doc) {
      return;
    }
    updateDocAccess({
      docId: doc.id,
      role: newRole,
      accessId: access.id,
    });
  };

  const canUpdate = isInherited
    ? false
    : (doc?.abilities.accesses_manage ?? false);

  return (
    <Box
      $width="100%"
      data-testid={`doc-share-member-row-${access.user.email}`}
      className="--docs--doc-share-member-item"
    >
      <SearchUserRow
        alwaysShowRight={true}
        user={access.user}
        right={
          <Box $direction="row" $align="center" $gap={spacingsTokens['2xs']}>
            <DocRoleDropdown
              currentRole={isInherited ? access.max_role : access.role}
              onSelectRole={onUpdate}
              canUpdate={canUpdate}
              message={message}
              rolesAllowed={access.abilities.set_role_to}
              access={access}
              doc={doc}
            />
          </Box>
        }
      />
    </Box>
  );
};
