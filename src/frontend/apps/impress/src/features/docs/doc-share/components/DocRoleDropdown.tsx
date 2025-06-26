import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DropdownMenu, DropdownMenuOption, Text } from '@/components';
import {
  Access,
  Doc,
  KEY_SUB_PAGE,
  Role,
  useTrans,
} from '@/docs/doc-management/';

import { useDeleteDocAccess, useDeleteDocInvitation } from '../api';
import { Invitation, isInvitation } from '../types';

type DocRoleDropdownProps = {
  doc?: Doc;
  access?: Access | Invitation;
  canUpdate?: boolean;
  currentRole: Role;
  message?: string;
  onSelectRole: (role: Role) => void;
  rolesAllowed?: Role[];
};

export const DocRoleDropdown = ({
  canUpdate = true,
  currentRole,
  message,
  onSelectRole,
  doc,
  rolesAllowed,
  access,
}: DocRoleDropdownProps) => {
  const { t } = useTranslation();
  const { transRole, translatedRoles } = useTrans();
  const queryClient = useQueryClient();
  const { toast } = useToastProvider();

  const { mutate: removeDocInvitation } = useDeleteDocInvitation({
    onSuccess: () => {
      if (!doc) {
        return;
      }

      console.log('doc HERE', doc);
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

  const { mutate: removeDocAccess } = useDeleteDocAccess({
    onSuccess: () => {
      if (!doc) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: [KEY_SUB_PAGE, { id: doc.id }],
      });
    },
    onError: () => {
      toast(t('Error while deleting invitation'), VariantType.ERROR, {
        duration: 4000,
      });
    },
  });

  const onRemove = () => {
    const invitation = isInvitation(access);
    if (!doc || !access) {
      return;
    }

    if (invitation) {
      removeDocInvitation({ invitationId: access.id, docId: doc.id });
    } else {
      removeDocAccess({ accessId: access.id, docId: doc.id });
    }
  };

  /**
   * When there is a higher role, the rolesAllowed are truncated
   * We display a message to indicate that there is a higher role
   */
  const topMessage = useMemo(() => {
    if (!canUpdate || !rolesAllowed || rolesAllowed.length === 0) {
      return message;
    }

    const allRoles = Object.keys(translatedRoles);

    if (rolesAllowed.length < allRoles.length) {
      let result = message ? `${message}\n\n` : '';
      result += t('This user has access inherited from a parent page.');
      return result;
    }

    return message;
  }, [canUpdate, rolesAllowed, translatedRoles, message, t]);

  const roles: DropdownMenuOption[] = Object.keys(translatedRoles).map(
    (key, index) => {
      const isLast = index === Object.keys(translatedRoles).length - 1;
      return {
        label: transRole(key as Role),
        callback: () => onSelectRole?.(key as Role),
        isSelected: currentRole === (key as Role),
        showSeparator: isLast,
      };
    },
  );

  if (!canUpdate) {
    return (
      <Text aria-label="doc-role-text" $variation="600">
        {transRole(currentRole)}
      </Text>
    );
  }

  return (
    <DropdownMenu
      topMessage={topMessage}
      label="doc-role-dropdown"
      showArrow={true}
      arrowCss={css`
        color: var(--c--theme--colors--primary-800) !important;
      `}
      options={[
        ...roles,
        {
          label: t('Remove access'),
          disabled: !access?.abilities.destroy,
          callback: onRemove,
        },
      ]}
    >
      <Text
        $theme="primary"
        $variation="800"
        $css={css`
          font-family: Arial, Helvetica, sans-serif;
        `}
      >
        {transRole(currentRole)}
      </Text>
    </DropdownMenu>
  );
};
