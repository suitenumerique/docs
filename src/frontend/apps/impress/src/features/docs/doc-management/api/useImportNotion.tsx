import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { baseApiUrl } from '@/api';

type ImportState = {
  title: string;
  status: 'pending' | 'fetched' | 'imported';
}[];

const computeSuccessPercentage = (importState?: ImportState) => {
  if (!importState) {
    return 0;
  }
  if (!importState.length) {
    return 100;
  }

  let fetchedFiles = 0;
  let importedFiles = 0;

  for (const file of importState) {
    if (file.status === 'fetched') {
      fetchedFiles += 1;
    } else if (file.status === 'imported') {
      fetchedFiles += 1;
      importedFiles += 1;
    }
  }

  const filesNb = importState.length;

  return Math.round(((fetchedFiles + importedFiles) / (2 * filesNb)) * 100);
};

export function useImportNotion() {
  const router = useRouter();

  const [importState, setImportState] = useState<ImportState>();

  useEffect(() => {
    // send the request with an Event Source
    const eventSource = new EventSource(
      `${baseApiUrl('1.0')}notion_import/run`,
      {
        withCredentials: true,
      },
    );

    eventSource.onmessage = (event) => {
      console.log('hello', event.data);
      const files = JSON.parse(event.data as string) as ImportState;

      // si tous les fichiers sont chargés, rediriger vers la home page
      if (files.some((file) => file.status === 'imported')) {
        eventSource.close();
        router.push('/');
      }

      // mettre à jour le state d'import
      setImportState(files);
    };

    return () => {
      eventSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    importState,
    percentageValue: computeSuccessPercentage(importState),
  };
}
