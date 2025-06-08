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
  const { transRole, translatedRoles } = useTrans();

  if (!canUpdate) {
    return (
      <Text aria-label="doc-role-text" $variation="600">
        {transRole(currentRole)}
      </Text>
    );
  }

  const roles: DropdownMenuOption[] = Object.keys(translatedRoles).map(
    (key) => {
      return {
        label: transRole(key as Role),
        callback: () => onSelectRole?.(key as Role),
        disabled: rolesAllowed && !rolesAllowed.includes(key as Role),
        isSelected: currentRole === (key as Role),
      };
    },
  );

  return (
    <DropdownMenu
      topMessage={message}
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
