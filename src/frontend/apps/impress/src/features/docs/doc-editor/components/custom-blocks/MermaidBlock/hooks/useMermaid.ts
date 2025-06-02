import { useEffect, useState } from 'react';

import type { MermaidImport, MermaidModule } from '../types/mermaidTypes';

export function useMermaid() {
  const [mermaidModule, setMermaidModule] = useState<MermaidModule | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')) as MermaidImport;
        mermaid.default.initialize({
          startOnLoad: true,
          theme: 'default',
          securityLevel: 'loose',
        });
        setMermaidModule(mermaid.default);
      } catch (error) {
        console.error('Failed to load Mermaid:', error);
        setError('Failed to load Mermaid');
      }
    };

    void loadMermaid();
  }, []);

  return { mermaidModule, error };
}
