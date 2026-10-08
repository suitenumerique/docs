/**
 * What the mention search can be replaced by once the user picked an item.
 * Each kind of mention (Interlinking, ...) adds its own inline content here.
 */
export type MentionedInlineContent = {
  type: 'interlinkingLinkInline';
  props: { docId: string };
};
