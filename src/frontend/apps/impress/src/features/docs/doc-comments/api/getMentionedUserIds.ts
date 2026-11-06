type BodyNode = {
  type?: unknown;
  props?: { userId?: unknown };
  content?: unknown;
  children?: unknown;
};

/**
 * Ids of the users mentioned in the body of a comment, each one once.
 * The body comes from the backend as is, so its shape is not trusted.
 */
export const getMentionedUserIds = (body: unknown): string[] => {
  const userIds = new Set<string>();

  const visit = (blocks: unknown) => {
    if (!Array.isArray(blocks)) {
      return;
    }

    (blocks as BodyNode[]).forEach((block) => {
      if (Array.isArray(block?.content)) {
        (block.content as BodyNode[]).forEach((inlineContent) => {
          const userId = inlineContent?.props?.userId;

          if (
            inlineContent?.type === 'userMentionInline' &&
            typeof userId === 'string' &&
            userId
          ) {
            userIds.add(userId);
          }
        });
      }

      visit(block?.children);
    });
  };

  visit(body);

  return Array.from(userIds);
};
