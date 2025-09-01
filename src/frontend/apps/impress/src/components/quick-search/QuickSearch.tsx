import { Command } from 'cmdk';
import {
  PropsWithChildren,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

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
};

export const QuickSearch = ({
  onFilter,
  inputContent,
  inputValue,
  loading,
  showInput = true,
  label,
  placeholder,
  children,
}: PropsWithChildren<QuickSearchProps>) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>('');

  // Auto-select first item when children change
  useEffect(() => {
    if (!children) {
      setSelectedValue('');
      return;
    }

    // Small delay for DOM to update
    const timeoutId = setTimeout(() => {
      const firstItem = ref.current?.querySelector('[cmdk-item]');
      if (firstItem) {
        const value =
          firstItem.getAttribute('data-value') ||
          firstItem.getAttribute('value') ||
          firstItem.textContent?.trim() ||
          '';
        if (value) {
          setSelectedValue(value);
        }
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [children]);

  return (
    <>
      <QuickSearchStyle />
      <div className="quick-search-container">
        <Command
          label={label}
          shouldFilter={false}
          ref={ref}
          value={selectedValue}
          onValueChange={setSelectedValue}
          tabIndex={0}
        >
          {showInput && (
            <QuickSearchInput
              loading={loading}
              withSeparator={hasChildrens(children)}
              inputValue={inputValue}
              onFilter={onFilter}
              placeholder={placeholder}
            >
              {inputContent}
            </QuickSearchInput>
          )}
          <Command.List>
            <Box>{children}</Box>
          </Command.List>
        </Command>
      </div>
    </>
  );
};
