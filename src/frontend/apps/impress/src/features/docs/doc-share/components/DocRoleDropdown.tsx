import { css } from 'styled-components';

import { DropdownMenu, DropdownMenuOption, Text } from '@/components';
import { Role, useTrans } from '@/features/docs/doc-management/';

type Props = {
  currentRole: Role;
  onSelectRole?: (role: Role) => void;
  canUpdate?: boolean;
  isLastOwner?: boolean;
  isOtherOwner?: boolean;
};
export const DocRoleDropdown = ({
  canUpdate = true,
  currentRole,
  onSelectRole,
  isLastOwner,
  isOtherOwner,
}: Props) => {
  const { transRole, translatedRoles, getNotAllowedMessage } = useTrans();

  const roles: DropdownMenuOption[] = Object.keys(translatedRoles).map(
    (key) => {
      return {
        label: transRole(key as Role),
        callback: () => onSelectRole?.(key as Role),
        disabled: isLastOwner || isOtherOwner,
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
      topMessage={getNotAllowedMessage(
        canUpdate,
        !!isLastOwner,
        !!isOtherOwner,
      )}
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
