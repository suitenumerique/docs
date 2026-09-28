import { z } from 'zod';

import { toMcpAuthContext } from '@/auth/context.js';
import { readDocument as readDocumentApi } from '@/docsApiClient.js';

import type { ToolExtra, ToolModule } from './types.js';

const REQUIRED_SCOPE = 'docs:documents:read';

export const inputSchema = {
  documentId: z.string().uuid(),
};

type Input = z.infer<z.ZodObject<typeof inputSchema>>;

const readDocument: ToolModule = {
  name: 'read_document',
  config: {
    title: 'Read document',
    description: 'Read a document accessible to the authenticated user.',
    inputSchema,
  },
  requiredScope: REQUIRED_SCOPE,
  async handler({ documentId }: Input, extra: ToolExtra) {
    const auth = toMcpAuthContext(extra.authInfo);
    const document = await readDocumentApi(auth, documentId);

    return {
      content: [
        {
          type: 'text',
          text: `# ${document.title ?? 'Untitled'}\n\n${document.content}${
            document.truncated ? '\n\n[content truncated]' : ''
          }`,
        },
      ],
    };
  },
};

export default readDocument;
