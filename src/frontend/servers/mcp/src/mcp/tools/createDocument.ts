import { z } from 'zod';

import { toMcpAuthContext } from '@/auth/context.js';
import { createDocument as createDocumentRequest } from '@/docsApiClient.js';

import type { ToolExtra, ToolModule } from './types.js';

const REQUIRED_SCOPE = 'docs:documents:create';

export const inputSchema = {
  title: z.string().min(1).max(255),
  content: z.string().max(50000),
  parentId: z.string().uuid().optional(),
};

type Input = z.infer<z.ZodObject<typeof inputSchema>>;

const createDocument: ToolModule = {
  name: 'create_document',
  config: {
    title: 'Create document',
    description: 'Create a document for the authenticated user.',
    inputSchema,
  },
  requiredScope: REQUIRED_SCOPE,
  async handler({ title, content, parentId }: Input, extra: ToolExtra) {
    const auth = toMcpAuthContext(extra.authInfo);
    const document = await createDocumentRequest(auth, {
      title,
      content,
      parentId,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Created document "${document.title}" (id: ${document.id}, created_at: ${document.created_at}).`,
        },
      ],
    };
  },
};

export default createDocument;
