import { VariantType, useToastProvider } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { validate as uuidValidate } from 'uuid';

import { useMentionUser } from '@/docs/doc-editor/api';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { useDocStore } from '@/docs/doc-management';

import { MentionedInlineContent } from '../types';

import { getBlockIdAtPos } from './getBlockIdAtPos';
import {
  INITIAL_BLOCK_ID,
  replaceInitialBlockId,
} from './replaceInitialBlockId';
import {
  MentionableUser,
  getMentionableUserName,
  useMentionableUsers,
} from './useMentionableUsers';

interface UseSearchUserMentionParams {
  editor: DocsBlockNoteEditor;
  getPos: () => number | undefined;
  search: string;
  enabled: boolean;
  onPick: (inlineContent: MentionedInlineContent) => void;
}

/**
 * The users proposed by the search of the mentions, and what happens when one
 * is picked: the search is replaced by the mention and the backend notifies
 * the user by email, with the block as anchor.
 */
export const useSearchUserMention = ({
  editor,
  getPos,
  search,
  enabled,
  onPick,
}: UseSearchUserMentionParams) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { currentDoc } = useDocStore();
  const notifyError = () => {
    toast(
      t('The person could not be notified of the mention.'),
      VariantType.ERROR,
    );
  };
  const { mutate: mentionUser } = useMentionUser({ onError: notifyError });

  /**
   * Users can only be mentioned by the members of the doc allowed to comment.
   */
  const { users } = useMentionableUsers({
    docId: currentDoc?.id,
    search,
    enabled: enabled && !!currentDoc?.abilities?.mention,
  });

  const selectUser = (user: MentionableUser) => {
    if (!editor.isEditable) {
      return;
    }

    const pos = getPos();
    let anchorId = pos === undefined ? undefined : getBlockIdAtPos(editor, pos);

    onPick({
      type: 'userMentionInline',
      props: { userId: user.id, fullName: getMentionableUserName(user) },
    });

    // After the pick, so that the search is not re-rendered while it is used.
    // TODO: remove when BlockNote stops giving "initialBlockId" to the first
    // block, see https://github.com/suitenumerique/docs/issues/2887
    if (anchorId === INITIAL_BLOCK_ID) {
      anchorId = replaceInitialBlockId(editor);
    }

    if (currentDoc && anchorId && uuidValidate(anchorId)) {
      mentionUser({
        docId: currentDoc.id,
        anchorId,
        mentionedUserId: user.id,
      });
    } else {
      // The mention is kept, but without an anchor the backend cannot notify
      notifyError();
    }
  };

  return { users, selectUser };
};
