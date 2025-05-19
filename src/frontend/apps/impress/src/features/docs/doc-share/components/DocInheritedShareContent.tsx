import { Button, Modal, ModalSize, useModal } from '@openfun/cunningham-react';
import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import {
  Access,
  RoleImportance,
  useDoc,
  useDocStore,
} from '../../doc-management';
import SimpleFileIcon from '../../docs-grid/assets/simple-document.svg';

import { DocShareMemberItem } from './DocShareMemberItem';
const ShareModalStyle = createGlobalStyle`
  .c__modal__title {
    padding-bottom: 0 !important;
  }
  .c__modal__scroller {
    padding: 15px 15px !important;
  }
`;

type Props = {
  rawAccesses: Access[];
};

const getMaxRoleBetweenAccesses = (access1: Access, access2: Access) => {
  const role1 = access1.max_role;
  const role2 = access2.max_role;

  const roleImportance1 = RoleImportance[role1];
  const roleImportance2 = RoleImportance[role2];

  return roleImportance1 > roleImportance2 ? role1 : role2;
};

export const DocInheritedShareContent = ({ rawAccesses }: Props) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { currentDoc } = useDocStore();

  const inheritedData = useMemo(() => {
    if (!currentDoc || rawAccesses.length === 0) {
      return null;
    }

    let parentId = null;
    let parentPathLength = 0;
    const members: Access[] = [];

    // Find the parent document with the longest path that is different from currentDoc
    for (const access of rawAccesses) {
      const docPath = access.document.path;

      // Skip if it's the current document
      if (access.document.id === currentDoc.id) {
        continue;
      }

      const findIndex = members.findIndex(
        (member) => member.user.id === access.user.id,
      );
      if (findIndex === -1) {
        members.push(access);
      } else {
        const accessToUpdate = members[findIndex];
        const currentRole = accessToUpdate.max_role;
        const maxRole = getMaxRoleBetweenAccesses(accessToUpdate, access);

        if (maxRole !== currentRole) {
          members[findIndex] = access;
        }
      }

      // Check if this document has a longer path than our current candidate
      if (docPath && (!parentId || docPath.length > parentPathLength)) {
        parentId = access.document.id;
        parentPathLength = docPath.length;
      }
    }

    return { parentId, members };
  }, [currentDoc, rawAccesses]);

  // Check if accesses map is empty
  const hasAccesses = rawAccesses.length > 0;

  if (!hasAccesses) {
    return null;
  }

  return (
    <Box $gap={spacingsTokens.sm}>
      <Box
        $gap={spacingsTokens.sm}
        $padding={{
          horizontal: spacingsTokens.base,
          vertical: spacingsTokens.sm,
          bottom: '0px',
        }}
      >
        <Text $variation="1000" $weight="bold" $size="sm">
          {t('Inherited share')}
        </Text>

        {inheritedData && (
          <DocInheritedShareContentItem
            key={inheritedData?.parentId}
            accesses={inheritedData?.members ?? []}
            document_id={inheritedData?.parentId ?? ''}
          />
        )}
      </Box>
    </Box>
  );
};

type DocInheritedShareContentItemProps = {
  accesses: Access[];
  document_id: string;
};
export const DocInheritedShareContentItem = ({
  accesses,
  document_id,
}: DocInheritedShareContentItemProps) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { data: doc, error, isLoading } = useDoc({ id: document_id });
  const errorCode = error?.status;

  const accessModal = useModal();
  if ((!doc && !isLoading && !error) || (error && errorCode !== 403)) {
    return null;
  }

  return (
    <>
      <Box
        $gap={spacingsTokens.sm}
        $width="100%"
        $direction="row"
        $align="center"
        $margin={{ bottom: spacingsTokens.sm }}
        $justify="space-between"
      >
        <Box $direction="row" $align="center" $gap={spacingsTokens.sm}>
          <SimpleFileIcon />
          <Box>
            {isLoading ? (
              <Box $direction="column" $gap="2px">
                <Box className="skeleton" $width="150px" $height="20px" />
                <Box className="skeleton" $width="200px" $height="17px" />
              </Box>
            ) : (
              <>
                <StyledLink href={`/docs/${doc?.id}`}>
                  <Text $variation="1000" $weight="bold" $size="sm">
                    {error && errorCode === 403
                      ? t('You do not have permission to view this document')
                      : (doc?.title ?? t('Untitled document'))}
                  </Text>
                </StyledLink>
                <Text $variation="600" $weight="400" $size="xs">
                  {t('Members of this page have access')}
                </Text>
              </>
            )}
          </Box>
        </Box>
        {!isLoading && (
          <Button color="primary-text" size="small" onClick={accessModal.open}>
            {t('See access')}
          </Button>
        )}
      </Box>
      {accessModal.isOpen && (
        <Modal
          isOpen
          closeOnClickOutside
          onClose={accessModal.close}
          title={
            <Box $align="flex-start">
              <Text $variation="1000" $weight="bold" $size="sm">
                {t('Access inherited from the parent page')}
              </Text>
            </Box>
          }
          size={ModalSize.MEDIUM}
        >
          <ShareModalStyle />
          <Box $padding={{ top: spacingsTokens.sm }}>
            {accesses.map((access) => (
              <Fragment key={access.id}>
                <DocShareMemberItem doc={doc} access={access} isInherited />
              </Fragment>
            ))}
          </Box>
        </Modal>
      )}
    </>
  );
};
