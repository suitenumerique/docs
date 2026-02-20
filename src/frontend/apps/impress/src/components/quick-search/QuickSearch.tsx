import { Command } from 'cmdk';
import { PropsWithChildren, ReactNode, useId, useRef, useState } from 'react';

import { hasChildrens } from '@/utils/children';

import { Box } from '../Box';

import { QuickSearchInput } from './QuickSearchInput';
import { QuickSearchStyle } from './QuickSearchStyle';

export type QuickSearchAction = {
  onSelect?: () => void;
  content: ReactNode;
};

export type QuickSearchData<T> = {
  groupName: string;
  groupKey?: string;
  elements: T[];
  emptyString?: string;
  startActions?: QuickSearchAction[];
  endActions?: QuickSearchAction[];
  showWhenEmpty?: boolean;
};

export type QuickSearchProps = {
  onFilter?: (str: string) => void;
  inputValue?: string;
  inputContent?: ReactNode;
  showInput?: boolean;
  loading?: boolean;
  label?: string;
  placeholder?: string;
  groupKey?: string;
};

export const QuickSearch = ({
  onFilter,
  inputContent,
  inputValue,
  showInput = true,
  label,
  placeholder,
  children,
}: PropsWithChildren<QuickSearchProps>) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const NO_SELECTION_VALUE = '__none__';
  const [userInteracted, setUserInteracted] = useState(false);
  const [selectedValue, setSelectedValue] = useState(NO_SELECTION_VALUE);
  const isExpanded = userInteracted;

  const handleValueChange = (val: string) => {
    if (userInteracted) {
      setSelectedValue(val);
    }
  };

  const handleUserInteract = () => {
    if (!userInteracted) {
      setUserInteracted(true);
    }
  };

  return (
    <>
      <QuickSearchStyle />
      <div className="quick-search-container">
        <Command
          label={label}
          shouldFilter={false}
          ref={ref}
          tabIndex={-1}
          value={selectedValue}
          onValueChange={handleValueChange}
          disablePointerSelection
        >
          {showInput && (
            <QuickSearchInput
              withSeparator={hasChildrens(children)}
              inputValue={inputValue}
              onFilter={onFilter}
              placeholder={placeholder}
              listId={listId}
              isExpanded={isExpanded}
              onUserInteract={handleUserInteract}
            >
              {inputContent}
            </QuickSearchInput>
          )}
          <Command.List id={listId} aria-label={label} role="listbox">
            <Box>{children}</Box>
          </Command.List>
        </Command>
      </div>
    </>
  );
};
