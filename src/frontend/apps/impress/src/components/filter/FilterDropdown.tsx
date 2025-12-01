import { css } from 'styled-components';

import { Box } from '../Box';
import { Icon } from '../Icon';
import { Text } from '../Text';
import {
  DropdownMenu,
  DropdownMenuOption,
} from '../dropdown-menu/DropdownMenu';

export type FilterDropdownProps = {
  options: DropdownMenuOption[];
  selectedValue?: string;
};

export const FilterDropdown = ({
  options,
  selectedValue,
}: FilterDropdownProps) => {
  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  if (options.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      selectedValues={selectedValue ? [selectedValue] : undefined}
      options={options}
    >
      <Box
        $css={css`
          border: 1px solid
            var(--c--contextuals--border--semantic--neutral--tertiary);
          border-radius: var(--c--globals--spacings--st);
          background-color: var(
            --c--contextuals--background--semantic--neutral--tertiary
          );
          gap: var(--c--globals--spacings--2xs);
          padding: var(--c--globals--spacings--2xs)
            var(--c--globals--spacings--xs);
        `}
        color="secondary"
        $direction="row"
        $align="center"
      >
        <Text $weight={400} $variation="tertiary" $theme="neutral">
          {selectedOption?.label ?? options[0].label}
        </Text>
        <Icon
          $size="s"
          iconName="keyboard_arrow_down"
          $variation="tertiary"
          $theme="neutral"
        />
      </Box>
    </DropdownMenu>
  );
};
