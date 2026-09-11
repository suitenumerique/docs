import { z } from 'zod';

import { toMcpAuthContext } from '@/auth/context.js';
import { searchDocuments as searchDocumentsApi } from '@/docsApiClient.js';

import type { ToolExtra, ToolModule } from './types.js';

const REQUIRED_SCOPE = 'docs:documents:search';

export const inputSchema = {
  query: z.string().min(1).max(512),
  limit: z.number().int().min(1).max(20).default(5),
};

type Input = z.infer<z.ZodObject<typeof inputSchema>>;

const searchDocuments: ToolModule = {
  name: 'search_documents',
  config: {
    title: 'Search documents',
    description: 'Search the documents accessible to the authenticated user.',
    inputSchema,
  },
  requiredScope: REQUIRED_SCOPE,
  async handler({ query, limit }: Input, extra: ToolExtra) {
    const auth = toMcpAuthContext(extra.authInfo);
    const results = await searchDocumentsApi(auth, query, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            results.map((doc) => ({
              id: doc.id,
              title: doc.title,
              excerpt: doc.excerpt,
              updated_at: doc.updated_at,
              children_ids: doc.children_ids,
            })),
            null,
            2,
          ),
        },
      ],
    };
  },
};

export default searchDocuments;
