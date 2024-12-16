import { Children, ReactNode } from 'react';

export const hasChildrens = (element: ReactNode): boolean => {
  let hasChildren = false;
  Children.forEach(element, (child: ReactNode) => {
    hasChildren = hasChildren || !!child;
  });
  return hasChildren;
};
