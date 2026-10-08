import { VariantType, useToastProvider } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { validate as uuidValidate } from 'uuid';

import { useMentionUser } from '@/docs/doc-editor/api';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { useDocStore } from '@/docs/doc-management';

import { MentionedInlineContent } from '../types';

import { getBlockIdAtPos } from './getBlockIdAtPos';
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
  const { mutate: mentionUser } = useMentionUser({
    onError: () => {
      toast(
        t('The person could not be notified of the mention.'),
        VariantType.ERROR,
      );
    },
  });

  /**
   * Users can only be mentioned by users allowed to comment.
   */
  const { users } = useMentionableUsers({
    docId: currentDoc?.id,
    search,
    enabled: enabled && !!currentDoc?.abilities?.comment,
  });

  const selectUser = (user: MentionableUser) => {
    if (!editor.isEditable) {
      return;
    }

    const pos = getPos();
    const anchorId =
      pos === undefined ? undefined : getBlockIdAtPos(editor, pos);

    onPick({
      type: 'userMentionInline',
      props: { userId: user.id, fullName: getMentionableUserName(user) },
    });

    if (currentDoc && anchorId && uuidValidate(anchorId)) {
      mentionUser({
        docId: currentDoc.id,
        anchorId,
        mentionedUserId: user.id,
      });
    }
  };

  return { users, selectUser };
};
