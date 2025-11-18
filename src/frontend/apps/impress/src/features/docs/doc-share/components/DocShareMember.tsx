import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { QuickSearchData } from '@/components/quick-search';
import { QuickSearchGroup } from '@/components/quick-search/QuickSearchGroup';
import { useCunninghamTheme } from '@/cunningham';
import { Access, Doc, Role } from '@/docs/doc-management/';

import { useDocAccesses, useUpdateDocAccess } from '../api';
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
  const { isLastOwner } = useWhoAmI(access);
  const { toast } = useToastProvider();

  const { spacingsTokens } = useCunninghamTheme();

  const message = isLastOwner
    ? t(
        'You are the sole owner of this group, make another member the group owner before you can change your own role or be removed from your document.',
      )
    : undefined;

  const { mutate: updateDocAccess } = useUpdateDocAccess({
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

  const canUpdate = isInherited ? false : !!doc?.abilities.accesses_manage;

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
              isLastOwner={isLastOwner}
              canUpdate={canUpdate}
              message={message}
              rolesAllowed={access.abilities.set_role_to}
              access={access}
              doc={doc}
              ariaLabel={t('Change role for {{name}}', {
                name: access.user.full_name || access.user.email,
              })}
            />
          </Box>
        }
      />
    </Box>
  );
};

interface QuickSearchGroupMemberProps {
  doc: Doc;
}

export const QuickSearchGroupMember = ({
  doc,
}: QuickSearchGroupMemberProps) => {
  const { t } = useTranslation();
  const membersQuery = useDocAccesses({
    docId: doc.id,
  });

  const membersData: QuickSearchData<Access> = useMemo(() => {
    const members = membersQuery.data || [];

    const count = members.length;

    return {
      groupName:
        count === 1
          ? t('Document owner')
          : t('Share with {{count}} users', {
              count: count,
            }),
      elements: members,
      endActions: undefined,
    };
  }, [membersQuery.data, t]);

  return (
    <Box aria-label={t('List members card')} $padding={{ bottom: '3xs' }}>
      <QuickSearchGroup
        group={membersData}
        renderElement={(access) => (
          <DocShareMemberItem doc={doc} access={access} />
        )}
      />
    </Box>
  );
};
