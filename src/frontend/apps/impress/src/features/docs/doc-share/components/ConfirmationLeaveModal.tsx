import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, ButtonCloseModal, Text } from '@/components';
import { useAuth } from '@/features/auth';

import { Doc } from '../../doc-management';
import { useDeleteDocAccess, useDocAccesses } from '../api';
import { useLeaveDoc } from '../api/useLeaveDoc';
import { useWhoAmI } from '../hooks/useWhoAmI';

const ModalStyle = createGlobalStyle`
  .c__modal__footer {
    margin-top: 0;
  }
`;

interface ConfirmationLeaveModalProps {
  doc: Doc;
  onClose: () => void;
}

export const ConfirmationLeaveModal = ({
  doc,
  onClose,
}: ConfirmationLeaveModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { mutate: leaveDoc, isPending: isLeavePending } = useLeaveDoc({
    onSuccess: () => {
      if (router.pathname !== `/`) {
        void router.push('/');
      } else {
        onClose();
      }
    },
  });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={onClose}
      // TODO: add a fix on the Modal component on Cunningham side
      // If aria-label is not set the modal add by default [object Object]
      aria-label={t('Confirmation to leave the document')}
      aria-labelledby="modal-leave-doc-title"
      aria-describedby="modal-leave-doc-desc"
      rightActions={
        <>
          {doc.abilities.leave ? (
            <ButtonsLeaveDoc
              leave={() => leaveDoc({ docId: doc.id })}
              isPending={isLeavePending}
              onClose={onClose}
            />
          ) : (
            <ButtonsLeaveMemberDoc
              doc={doc}
              leave={() => leaveDoc({ docId: doc.id })}
              isLeavePending={isLeavePending}
              onClose={onClose}
            />
          )}
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <>
          <Text
            $size="h6"
            as="h2"
            id="modal-leave-doc-title"
            $margin="0"
            $align="flex-start"
          >
            {t('Leave a doc')}
          </Text>
          <Box $position="absolute" $css="top: 4px; right: 4px;">
            <ButtonCloseModal
              aria-label={t('Close the leave modal')}
              onClick={onClose}
            />
          </Box>
        </>
      }
    >
      <ModalStyle />
      <Text
        id="modal-leave-doc-desc"
        className="--docs--modal-leave-doc"
        $size="sm"
        $variation="secondary"
        $display="inline-block"
        as="p"
        $css={css`
          line-height: 1.6;
        `}
      >
        {doc.abilities.leave ? (
          <TextModal />
        ) : (
          <TextModalMember docId={doc.id} />
        )}
      </Text>
    </Modal>
  );
};

const TextModal = () => {
  const { t } = useTranslation();
  return (
    <Trans t={t}>
      This document and <strong>all the sub-documents</strong> will no longer be
      visible in your document list and in your search results. The rights that
      were given to you on this document will be removed.
    </Trans>
  );
};

const TextModalMember = ({ docId }: { docId: string }) => {
  const { t } = useTranslation();
  const { access, isLoading, isError } = useGetMyAccess(docId);
  const { isLastOwner } = useWhoAmI(access);

  if (isLoading) {
    return null;
  }

  if (isError) {
    return (
      <Trans t={t}>
        Unable to verify your permissions on this document.{' '}
        <strong>Leaving has been disabled</strong> until your access level can
        be confirmed. Please try again later.
      </Trans>
    );
  }

  if (isLastOwner) {
    return (
      <Trans t={t}>
        You cannot leave this document{' '}
        <strong>because you are the unique owner</strong>. Add another user with
        the owner role to ensure you can transfer ownership before leaving the
        document.
      </Trans>
    );
  }

  return <TextModal />;
};

/**
 * Simple button to leave a doc
 * The user is not a member of the doc, he can just leave the doc
 */
const ButtonsLeaveDoc = ({
  leave,
  isPending,
  onClose,
}: {
  leave: () => void;
  isPending: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Button
        aria-label={t('Cancel leaving the document')}
        variant="secondary"
        fullWidth
        autoFocus
        onClick={onClose}
        disabled={isPending}
      >
        {t('Cancel')}
      </Button>
      <Button
        aria-label={t('Confirm leaving the document')}
        color="error"
        fullWidth
        onClick={leave}
        disabled={isPending}
      >
        {t('Leave')}
      </Button>
    </>
  );
};

/**
 * The user is a member of the doc, he can leave the doc but
 * if he is the last owner, he need to transfer the ownership
 * before leaving the doc
 */
const ButtonsLeaveMemberDoc = ({
  doc,
  leave,
  isLeavePending,
  onClose,
}: {
  doc: Doc;
  leave: () => void;
  isLeavePending: boolean;
  onClose: () => void;
}) => {
  const { mutateAsync: deleteDocAccess, isPending: isDeletePending } =
    useDeleteDocAccess();
  const { access, isLoading, isError } = useGetMyAccess(doc.id);
  const { isLastOwner } = useWhoAmI(access);

  /**
   * If the user is the last owner, or ownership cannot be verified (loading or
   * error), we don't display the leave button to avoid failing open.
   */
  if (isLastOwner || isLoading || isError) {
    return null;
  }

  return (
    <ButtonsLeaveDoc
      leave={async () => {
        if (access) {
          await deleteDocAccess({ docId: doc.id, accessId: access.id });
          leave();
        } else {
          leave();
        }
      }}
      isPending={isDeletePending || isLeavePending}
      onClose={onClose}
    />
  );
};

const useGetMyAccess = (docId: string) => {
  const { user } = useAuth();
  const {
    data: accesses,
    isLoading,
    isError,
  } = useDocAccesses({
    docId,
  });
  const access = useMemo(() => {
    return accesses?.find((access) => access.user.id === user?.id);
  }, [accesses, user]);

  return { access, isLoading, isError };
};
