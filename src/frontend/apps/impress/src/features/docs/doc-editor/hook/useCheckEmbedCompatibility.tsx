import { useEffect, useState } from 'react';

export const useCheckEmbedCompatibility = () => {
  const [isCompatible, setIsCompatible] = useState(true);

  useEffect(() => {
    const embedElement = document.createElement('embed');

    setIsCompatible(
      embedElement instanceof HTMLObjectElement ||
        embedElement instanceof HTMLEmbedElement,
    );
  }, []);

  return { isCompatible } as const;
};
