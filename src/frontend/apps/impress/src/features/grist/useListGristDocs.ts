import { useEffect, useState } from 'react';

import { APIError, errorCauses, gristFetchApi } from '@/api';

export interface Workspace {
  id: number;
  name: string;
  access: string;
  docs: Doc[];
  org: Org;
}

export interface Doc {
  id: number;
  name: string;
  access: string;
  isPinned: boolean;
  urlId: null;
}

export interface Org {
  id: number;
  name: string;
  domain: string;
  owner: Owner;
  access: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Owner {
  id: number;
  name: string;
  picture: null;
}

export const useListGristDocs = (): { docs: Doc[] } => {
  const [docs, setDocs] = useState<Doc[]>([]);

  const fetchDocs = async () => {
    const DEFAULT_WORKSPACE_ID = 2;
    const url = `workspaces/${DEFAULT_WORKSPACE_ID}`;
    const response = await gristFetchApi(url);
    if (!response.ok) {
      throw new APIError(
        'Failed to request ai transform',
        await errorCauses(response),
      );
    }
    return (await response.json()) as Promise<Workspace>;
  };

  useEffect(() => {
    fetchDocs()
      .then((workspace) => {
        setDocs(workspace.docs);
      })
      .catch((error) => {
        console.error('Error fetching Grist documents:', error);
      });
  }, []);

  return {
    docs,
  };
};
