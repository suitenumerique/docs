import { DefaultThreadStoreAuth } from '@blocknote/core/comments';

export class DocsThreadStoreAuth extends DefaultThreadStoreAuth {
  constructor(
    userId: string,
    role: 'comment' | 'editor',
    public canSee: boolean,
  ) {
    super(userId, role);
  }
}
