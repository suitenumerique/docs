import { useEffect, useState } from 'react';

import type { EditorDimensions } from '../types';

export const useEditorDimensions = (
  parentRef?: React.RefObject<HTMLDivElement | null>,
) => {
  const [dimensions, setDimensions] = useState<EditorDimensions>({
    height: 0,
    width: 0,
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (parentRef?.current) {
        const rect = parentRef.current.getBoundingClientRect();
        setDimensions({
          height: rect.height,
          width: rect.width,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [parentRef]);

  return dimensions;
};
