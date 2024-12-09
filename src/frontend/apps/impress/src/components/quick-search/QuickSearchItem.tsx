import { Command } from 'cmdk';
import { PropsWithChildren } from 'react';

type Props = {
  onSelect?: (value: string) => void;
};
export const QuickSearchItem = ({
  children,
  onSelect,
}: PropsWithChildren<Props>) => {
  return <Command.Item onSelect={onSelect}>{children}</Command.Item>;
};
