import { createExtension } from '@blocknote/core';
import { Mark, MarkType, Node } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ySyncPluginKey } from 'y-prosemirror';

/**
 * A comment on an inline node without content (doc link, user mention) is a
 * `comment` mark on the node itself, and y-prosemirror only stores the
 * attributes of an element node in Yjs, never its marks
 * (https://github.com/yjs/y-prosemirror/issues/47). The mark was then lost on
 * reload and never reached the collaborators.
 *
 * The inline nodes that spread `inlineNodeCommentsPropSchema` keep a copy of
 * their comment marks in this prop, which Yjs does store.
 */
export const COMMENT_MARKS_PROP = 'commentMarks';

export const inlineNodeCommentsPropSchema = {
  [COMMENT_MARKS_PROP]: {
    default: '',
  },
} as const;

const COMMENT_MARK = 'comment';

const PLUGIN_KEY = new PluginKey('docs-inline-node-comments');

const hasCommentMarksProp = (node: Node) =>
  !!node.type.spec.attrs && COMMENT_MARKS_PROP in node.type.spec.attrs;

/**
 * Sorted, so that the same marks always give the same value and no update is
 * sent to Yjs when only their order changed.
 */
export const serializeCommentMarks = (
  marks: readonly Mark[],
  markType: MarkType,
) => {
  const comments = marks
    .filter((mark) => mark.type === markType)
    .map((mark) => ({
      threadId: String(mark.attrs.threadId),
      orphan: mark.attrs.orphan === true,
    }))
    .sort((a, b) =>
      a.threadId < b.threadId ? -1 : a.threadId > b.threadId ? 1 : 0,
    );

  return comments.length ? JSON.stringify(comments) : '';
};

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
 * Keeps the comment marks of the inline nodes and their `commentMarks` prop
 * in sync:
 * - a local change writes the marks into the prop, which y-prosemirror sends
 *   to Yjs;
 * - a change coming from Yjs (load, collaborator, undo) rebuilds the nodes
 *   without marks, so the marks are restored from the prop.
 */
export const InlineNodeCommentsExtension = createExtension(() => ({
  key: 'inlineNodeComments',
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

        const isFromYjs = transactions.some(
          (tr) =>
            (
              tr.getMeta(ySyncPluginKey) as
                { isChangeOrigin?: boolean } | undefined
            )?.isChangeOrigin,
        );

        const tr = newState.tr;
        newState.doc.nodesBetween(from, to, (node, pos, parent) => {
          if (!hasCommentMarksProp(node)) {
            return true;
          }

          const marksValue = serializeCommentMarks(node.marks, markType);

          if (isFromYjs) {
            const restoredMarks = parseCommentMarks(
              node.attrs[COMMENT_MARKS_PROP],
              markType,
            );

            if (
              serializeCommentMarks(restoredMarks, markType) !== marksValue &&
              parent?.type.allowsMarkType(markType)
            ) {
              node.marks
                .filter((mark) => mark.type === markType)
                .forEach((mark) => tr.removeNodeMark(pos, mark));
              restoredMarks.forEach((mark) => tr.addNodeMark(pos, mark));
            }
          } else if (node.attrs[COMMENT_MARKS_PROP] !== marksValue) {
            tr.setNodeAttribute(pos, COMMENT_MARKS_PROP, marksValue);
          }

          return false;
        });

        if (!tr.docChanged) {
          return null;
        }

        if (isFromYjs) {
          // The marks come from Yjs: y-prosemirror and the other plugins
          // must not take them as a local change.
          tr.setMeta(ySyncPluginKey, { isChangeOrigin: true });
        } else if (
          transactions[transactions.length - 1].getMeta('addToHistory') ===
          false
        ) {
          // y-prosemirror reads `addToHistory` from the last transaction only,
          // this one must not change what the user's change asked for.
          tr.setMeta('addToHistory', false);
        }

        return tr;
      },
    }),
  ],
}));
