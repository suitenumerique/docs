import { createExtension } from '@blocknote/core';
import { Extension } from '@tiptap/core';
import { Mark, MarkType, Node } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * A comment on an inline node without content (doc link, user mention) is a
 * `comment` mark on the node itself, and y-prosemirror only stores the
 * attributes of an element node in Yjs, never its marks
 * (https://github.com/yjs/y-prosemirror/issues/47). The mark was then lost on
 * reload and never reached the collaborators.
 *
 * These nodes got a hidden attribute holding a copy of their comment marks,
 * which Yjs does store. @y/prosemirror stores the marks of these nodes now:
 * the attribute is no longer written, it only restores the comments of the
 * documents written before.
 *
 * TODO: drop this extension once BlockNote keeps the comments of inline
 * nodes itself (https://github.com/TypeCellOS/BlockNote/issues/3358, see
 * https://github.com/suitenumerique/docs/issues/2878). Migrate the
 * `commentMarks` attributes of the existing documents first, otherwise
 * their comments on doc links and mentions are lost again.
 */
export const COMMENT_MARKS_PROP = 'commentMarks';

/**
 * Declared here rather than in the inline content specs, so that they don't
 * depend on the comments, and the attribute stays out of the blocks JSON and
 * of the exports.
 */
export const COMMENTABLE_INLINE_NODES = [
  'interlinkingLinkInline',
  'userMentionInline',
];

const InlineNodeCommentsAttribute = Extension.create({
  name: 'inlineNodeCommentsAttribute',

  addGlobalAttributes() {
    return [
      {
        types: COMMENTABLE_INLINE_NODES,
        attributes: {
          [COMMENT_MARKS_PROP]: {
            default: null,
            rendered: false,
            parseHTML: () => null,
          },
        },
      },
    ];
  },
});

const COMMENT_MARK = 'comment';

const PLUGIN_KEY = new PluginKey('docs-inline-node-comments');

// Meta that @y/prosemirror sets on the transactions it applies from Yjs.
const Y_SYNC_TRANSACTION_META = 'y-sync-transaction';
// Meta that @y/prosemirror's undo plugin takes as a change from Yjs.
const Y_SYNC_APPEND_META = 'y-sync-append';

const hasCommentMarksProp = (node: Node) =>
  !!node.type.spec.attrs && COMMENT_MARKS_PROP in node.type.spec.attrs;

/**
 * The value comes from Yjs, so anything unexpected is ignored rather than
 * thrown.
 */
export const parseCommentMarks = (
  value: unknown,
  markType: MarkType,
): Mark[] => {
  if (typeof value !== 'string' || !value) {
    return [];
  }

  let comments: unknown;
  try {
    comments = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(comments)) {
    return [];
  }

  return comments.flatMap((comment: unknown) => {
    if (
      typeof comment !== 'object' ||
      comment === null ||
      !('threadId' in comment) ||
      typeof comment.threadId !== 'string' ||
      !comment.threadId
    ) {
      return [];
    }

    return [
      markType.create({
        threadId: comment.threadId,
        orphan: 'orphan' in comment && comment.orphan === true,
      }),
    ];
  });
};

/**
 * Restores the comment marks of the inline nodes from their `commentMarks`
 * prop, when a change coming from Yjs (load, collaborator, undo) brings a node
 * without any: a document written before @y/prosemirror stored them.
 *
 * The prop is no longer written. @y/prosemirror stores the marks, and writing
 * the prop in the same transaction as a mark kept its sync binding correcting
 * the document forever: the tab froze as soon as a doc link or a mention was
 * commented. A comment restored from a stale prop is harmless, its thread
 * being resolved or deleted makes it orphan.
 */
export const InlineNodeCommentsExtension = createExtension(() => ({
  key: 'inlineNodeComments',
  tiptapExtensions: [InlineNodeCommentsAttribute],
  prosemirrorPlugins: [
    new Plugin({
      key: PLUGIN_KEY,
      appendTransaction(transactions, oldState, newState) {
        const markType = newState.schema.marks[COMMENT_MARK];
        if (!markType || !transactions.some((tr) => tr.docChanged)) {
          return null;
        }

        // Only look at the changed part of the document, not the whole
        // document at each keystroke.
        const from = oldState.doc.content.findDiffStart(newState.doc.content);
        const end = oldState.doc.content.findDiffEnd(newState.doc.content);
        if (from === null || !end) {
          return null;
        }
        const to = Math.min(
          Math.max(from, end.b + Math.max(0, from - end.a)),
          newState.doc.content.size,
        );

        if (
          !transactions.some(
            (tr) => tr.getMeta(Y_SYNC_TRANSACTION_META) != null,
          )
        ) {
          return null;
        }

        const tr = newState.tr;
        newState.doc.nodesBetween(from, to, (node, pos, parent) => {
          if (!hasCommentMarksProp(node)) {
            return true;
          }

          // Only a node without comment marks gets them back: rewriting the
          // marks a node holds, `orphan` flag included, fights the corrections
          // of the sync binding just as well.
          if (
            !node.marks.some((mark) => mark.type === markType) &&
            parent?.type.allowsMarkType(markType)
          ) {
            parseCommentMarks(node.attrs[COMMENT_MARKS_PROP], markType).forEach(
              (mark) => tr.addNodeMark(pos, mark),
            );
          }

          return false;
        });

        if (!tr.docChanged) {
          return null;
        }

        // The marks come from Yjs: the undo history must not take them as a
        // local change.
        tr.setMeta(Y_SYNC_APPEND_META, true);
        tr.setMeta('addToHistory', false);

        return tr;
      },
    }),
  ],
}));
