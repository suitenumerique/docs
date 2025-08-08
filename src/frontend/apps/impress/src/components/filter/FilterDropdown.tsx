import { css } from 'styled-components';

import { Box } from '../Box';
import { DropdownMenu, DropdownMenuOption } from '../DropdownMenu';
import { Icon } from '../Icon';
import { Text } from '../Text';

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
            ${selectedOption
              ? 'var(--c--theme--colors--primary-500)'
              : 'var(--c--theme--colors--greyscale-250)'};
          border-radius: 4px;
          background-color: ${selectedOption
            ? 'var(--c--theme--colors--primary-100)'
            : 'var(--c--theme--colors--greyscale-000)'};
          gap: var(--c--theme--spacings--2xs);
          padding: var(--c--theme--spacings--2xs) var(--c--theme--spacings--xs);
        `}
        color="secondary"
        $direction="row"
        $align="center"
      >
        <Text
          $weight={400}
          $variation={selectedOption ? '800' : '600'}
          $theme={selectedOption ? 'primary' : 'greyscale'}
        >
          {selectedOption?.label ?? options[0].label}
        </Text>
        <Icon
          $size="16px"
          iconName="keyboard_arrow_down"
          $variation={selectedOption ? '800' : '600'}
          $theme={selectedOption ? 'primary' : 'greyscale'}
        />
      </Box>
    </DropdownMenu>
  );
};
