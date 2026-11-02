import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ySyncPluginKey } from 'y-prosemirror';

import {
  COMMENT_MARK_NAME,
  INLINE_NODE_COMMENTS_PROP,
  commentMarksEqual,
  extractCommentMarks,
  parseCommentMarks,
  stringifyCommentMarks,
} from './inlineNodeComments';

const inlineNodeCommentsPluginKey = new PluginKey('inlineNodeComments');

/**
 * A node opts into comment persistence simply by declaring the
 * `commentMarks` prop, so we detect support from its attributes rather than
 * hard-coding a list of node types.
 */
const supportsCommentMarks = (node: ProseMirrorNode): boolean =>
  Object.prototype.hasOwnProperty.call(node.attrs, INLINE_NODE_COMMENTS_PROP);

/**
 * Keeps BlockNote comments attached to content-less inline nodes (doc links,
 * user mentions, ...) across reloads and between collaborators.
 *
 * y-prosemirror persists the *attributes* of such nodes in Yjs, but not their
 * marks, and a comment is a `comment` mark. The highlight therefore only lived
 * in the local editor state and was lost on reload (#2807, #2878).
 *
 * This plugin mirrors the comment marks into the persisted `commentMarks`
 * attribute and derives the marks back from it:
 * - on a *local* edit, the marks are authoritative -> write the attribute;
 * - on a change coming from Yjs (initial load or a remote peer), the attribute
 *   is authoritative -> re-apply the marks.
 *
 * The two directions never fight: after a restore the marks already match the
 * attribute, and after a write the attribute already matches the marks, so the
 * follow-up pass is a no-op.
 */
export const InlineNodeCommentsExtension = Extension.create({
  name: 'inlineNodeComments',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: inlineNodeCommentsPluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          const commentType = newState.schema.marks[COMMENT_MARK_NAME];
          if (!commentType) {
            return null;
          }

          // A change coming from Yjs (initial load or a remote peer) carries the
          // y-sync plugin meta. It restored the persisted attribute but not the
          // marks, so the attribute wins. Any other change is a local edit of
          // the comments, so the marks win.
          const fromYjs = transactions.some(
            (transaction) =>
              transaction.getMeta(ySyncPluginKey) !== undefined,
          );

          const { tr } = newState;
          let changed = false;

          newState.doc.descendants((node, pos) => {
            if (!supportsCommentMarks(node)) {
              return;
            }

            const markData = extractCommentMarks(node.marks);
            const attrValue = (node.attrs[INLINE_NODE_COMMENTS_PROP] ??
              '') as string;

            if (fromYjs) {
              const attrData = parseCommentMarks(attrValue);

              if (!commentMarksEqual(markData, attrData)) {
                const end = pos + node.nodeSize;
                tr.removeMark(pos, end, commentType);
                attrData.forEach((data) => {
                  tr.addMark(
                    pos,
                    end,
                    commentType.create({
                      threadId: data.threadId,
                      orphan: data.orphan,
                    }),
                  );
                });
                changed = true;
              }
            } else {
              const serialized = stringifyCommentMarks(markData);

              if (serialized !== attrValue) {
                tr.setNodeAttribute(pos, INLINE_NODE_COMMENTS_PROP, serialized);
                changed = true;
              }
            }
          });

          if (!changed) {
            return null;
          }

          // The attribute and the marks are derived from each other, so this
          // reconciliation must not become its own undo step.
          tr.setMeta('addToHistory', false);

          return tr;
        },
      }),
    ];
  },
});
