import { v4 as uuidv4 } from 'uuid';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

/**
 * BlockNote gives this fixed id, not a uuid, to the first block of a new doc
 * and keeps it once the block has content.
 */
export const INITIAL_BLOCK_ID = 'initialBlockId';

/**
 * Gives a uuid to the block with the initial id, so that it can be the anchor
 * of a mention: the backend only accepts uuids. BlockNote does not restore the
 * initial id of a block that has content.
 *
 * TODO: remove when BlockNote stops giving "initialBlockId" to the first block,
 * see https://github.com/suitenumerique/docs/issues/2887
 *
 * @returns the new id of the block, undefined when there is no such block.
 */
export const replaceInitialBlockId = (
  editor: DocsBlockNoteEditor,
): string | undefined =>
  editor.transact((tr) => {
    let newId: string | undefined;

    tr.doc.descendants((node, pos) => {
      if (newId) {
        return false;
      }

      if (
        node.type.isInGroup('bnBlock') &&
        node.attrs.id === INITIAL_BLOCK_ID
      ) {
        newId = uuidv4();
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: newId });
        return false;
      }

      return true;
    });

    return newId;
  });
