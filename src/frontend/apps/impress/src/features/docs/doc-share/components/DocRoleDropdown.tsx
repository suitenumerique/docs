import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DropdownMenu, DropdownMenuOption, Text } from '@/components';
import { Role, useTrans } from '@/docs/doc-management/';

type DocRoleDropdownProps = {
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
  rolesAllowed,
}: DocRoleDropdownProps) => {
  const { t } = useTranslation();
  const { transRole, translatedRoles } = useTrans();

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
    (key) => {
      return {
        label: transRole(key as Role),
        callback: () => onSelectRole?.(key as Role),
        isSelected: currentRole === (key as Role),
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
      options={roles}
    >
      <Text
        $variation="600"
        $css={css`
          font-family: Arial, Helvetica, sans-serif;
        `}
      >
        {transRole(currentRole)}
      </Text>
    </DropdownMenu>
  );
};
