import { Command } from 'cmdk';
import { PropsWithChildren, ReactNode, useId, useRef } from 'react';

import { hasChildrens } from '@/utils/children';

import { Box } from '../Box';

import { QuickSearchInput } from './QuickSearchInput';
import { QuickSearchStyle } from './QuickSearchStyle';

export type QuickSearchAction = {
  onSelect?: () => void;
  content: ReactNode;
};

export type QuickSearchData<T> = {
  groupName?: string;
  groupKey?: string;
  elements: T[];
  emptyString?: string;
  startActions?: QuickSearchAction[];
  endActions?: QuickSearchAction[];
  showWhenEmpty?: boolean;
};

export type QuickSearchProps = {
  isSelectByDefault?: boolean;
  onFilter?: (str: string) => void;
  inputValue?: string;
  inputContent?: ReactNode;
  showInput?: boolean;
  loading?: boolean;
  label?: string;
  placeholder?: string;
  groupKey?: string;
  beforeList?: ReactNode;
};

export const QuickSearch = ({
  isSelectByDefault,
  onFilter,
  inputContent,
  inputValue,
  showInput = true,
  label,
  loading,
  placeholder,
  beforeList,
  children,
}: PropsWithChildren<QuickSearchProps>) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  return (
    <>
      <QuickSearchStyle />
      <div className="quick-search-container">
        <Command
          label={label}
          shouldFilter={false}
          ref={ref}
          tabIndex={-1}
          disablePointerSelection
          value={!isSelectByDefault ? '__none__' : undefined}
        >
          {showInput && (
            <QuickSearchInput
              label={label}
              withSeparator={hasChildrens(children)}
              inputValue={inputValue}
              onFilter={onFilter}
              placeholder={placeholder}
              listId={listId}
            >
              {inputContent}
            </QuickSearchInput>
          )}
          {beforeList}
          <Command.List id={listId} aria-busy={loading}>
            <Box>{children}</Box>
          </Command.List>
        </Command>
      </div>
    </>
  );
};
