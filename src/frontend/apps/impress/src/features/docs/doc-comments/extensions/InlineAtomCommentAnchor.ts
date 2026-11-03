import { Extension } from '@tiptap/core';
import { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, Transaction } from '@tiptap/pm/state';
import { ySyncPluginKey } from 'y-prosemirror';

const COMMENT_MARK = 'comment';
const ATTR = 'commentAnchors';

/**
 * Inline nodes the comments can be anchored on.
 */
const ANCHORED_NODES = ['interlinkingLinkInline', 'math', 'userMentionInline'];

type Anchor = { threadId: string; orphan: boolean };

/**
 * y-prosemirror only syncs the marks of text nodes, so the `comment` mark set
 * on an inline atom node (doc link, math) is lost on reload and for the other
 * collaborators. We mirror the mark in a node attribute, which is synced, and
 * restore the mark from it when the document comes from Yjs.
 *
 * - Local transactions: the mark is the source of truth, the attribute follows.
 * - Yjs transactions (load, remote changes, undo): the attribute is the
 *   source of truth, the mark follows.
 */
export const InlineAtomCommentAnchor = Extension.create({
  name: 'inlineAtomCommentAnchor',

  addGlobalAttributes() {
    return [
      {
        types: ANCHORED_NODES,
        attributes: {
          [ATTR]: {
            default: null,
            rendered: false,
            parseHTML: () => null,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('inlineAtomCommentAnchor'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) {
            return null;
          }

          const fromYjs = transactions.some(isYjsTransaction);
          const markType = newState.schema.marks[COMMENT_MARK];
          if (!markType) {
            return null;
          }

          const tr = newState.tr;
          newState.doc.descendants((node, pos) => {
            if (!ANCHORED_NODES.includes(node.type.name)) {
              return;
            }

            const marked = getMarkAnchors(node);
            const stored = parseAnchors(node.attrs[ATTR]);

            if (fromYjs) {
              syncMarksFromAttr(tr, node, pos, marked, stored);
            } else {
              const serialized = serializeAnchors(marked);
              if ((node.attrs[ATTR] ?? null) !== serialized) {
                tr.setNodeMarkup(
                  pos,
                  undefined,
                  { ...node.attrs, [ATTR]: serialized },
                  node.marks,
                );
              }
            }
          });

          if (!tr.docChanged) {
            return null;
          }

          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },
});

const isYjsTransaction = (tr: Transaction) => {
  const meta = tr.getMeta(ySyncPluginKey) as
    { isChangeOrigin?: boolean; snapshot?: unknown } | undefined;
  // The initial render and the snapshots carry `snapshot` without isChangeOrigin
  return !!meta && (!!meta.isChangeOrigin || 'snapshot' in meta);
};

const getMarkAnchors = (node: PMNode): Anchor[] =>
  node.marks
    .filter((mark) => mark.type.name === COMMENT_MARK && mark.attrs.threadId)
    .map((mark) => ({
      threadId: mark.attrs.threadId as string,
      orphan: !!mark.attrs.orphan,
    }))
    .sort((a, b) => a.threadId.localeCompare(b.threadId));

const parseAnchors = (value: unknown): Anchor[] => {
  if (typeof value !== 'string' || !value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as Anchor[];
    return Array.isArray(parsed) ? parsed.filter((a) => !!a?.threadId) : [];
  } catch {
    return [];
  }
};

const serializeAnchors = (anchors: Anchor[]) =>
  anchors.length ? JSON.stringify(anchors) : null;

const syncMarksFromAttr = (
  tr: Transaction,
  node: PMNode,
  pos: number,
  marked: Anchor[],
  stored: Anchor[],
) => {
  const markType = tr.doc.type.schema.marks[COMMENT_MARK];
  const from = pos;
  const to = pos + node.nodeSize;

  // Marks removed by a collaborator
  node.marks.forEach((mark) => {
    if (
      mark.type === markType &&
      !stored.some((a) => a.threadId === mark.attrs.threadId)
    ) {
      tr.removeMark(from, to, mark);
    }
  });

  // Marks missing or outdated (e.g. the orphan state changed)
  stored.forEach((anchor) => {
    const current = marked.find((a) => a.threadId === anchor.threadId);
    if (current?.orphan === anchor.orphan) {
      return;
    }
    if (current) {
      tr.removeMark(
        from,
        to,
        node.marks.find((m) => m.attrs.threadId === anchor.threadId),
      );
    }
    tr.addMark(from, to, markType.create(anchor));
  });
};
