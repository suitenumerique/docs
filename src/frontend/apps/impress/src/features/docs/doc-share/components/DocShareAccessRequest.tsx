import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Box,
  DropdownMenu,
  DropdownMenuOption,
  IconOptions,
  LoadMoreText,
} from '@/components';
import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';
import { useCunninghamTheme } from '@/cunningham';
import { AccessRequest, Doc, Role } from '@/docs/doc-management/';
import { useResponsiveStore } from '@/stores';

import { useDeleteDocAccess, useUpdateDocAccess } from '../api';
import { useDocAccessRequestsInfinite } from '../api/useDocAccessRequest';

import { DocRoleDropdown } from './DocRoleDropdown';
import { SearchUserRow } from './SearchUserRow';

type Props = {
  doc: Doc;
  accessRequest: AccessRequest;
};

const DocShareAccessRequestItem = ({ doc, accessRequest }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { isDesktop } = useResponsiveStore();
  const { spacingsTokens } = useCunninghamTheme();

  const { mutate: updateDocAccess } = useUpdateDocAccess({
    onError: () => {
      toast(t('Error during invitation update'), VariantType.ERROR, {
        duration: 4000,
      });
    },
  });

  const { mutate: removeDocAccess } = useDeleteDocAccess({
    onError: () => {
      toast(t('Error while deleting invitation'), VariantType.ERROR, {
        duration: 4000,
      });
    },
  });

  const onUpdate = (newRole: Role) => {
    updateDocAccess({
      docId: doc.id,
      role: newRole,
      accessId: accessRequest.id,
    });
  };

  const onRemove = () => {
    removeDocAccess({ accessId: accessRequest.id, docId: doc.id });
  };

  const moreActions: DropdownMenuOption[] = [
    {
      label: t('Delete'),
      icon: 'delete',
      callback: onRemove,
      disabled: !accessRequest.abilities.destroy,
    },
  ];

  return (
    <Box
      $width="100%"
      data-testid={`doc-share-access-request-row-${accessRequest.user.email}`}
      className="--docs--doc-share-access-request-item"
    >
      <SearchUserRow
        alwaysShowRight={true}
        user={accessRequest.user}
        right={
          <Box $direction="row" $align="center" $gap={spacingsTokens['2xs']}>
            <DocRoleDropdown
              currentRole={accessRequest.role}
              onSelectRole={onUpdate}
              canUpdate={doc.abilities.accesses_manage}
            />

            {isDesktop && doc.abilities.accesses_manage && (
              <DropdownMenu options={moreActions}>
                <IconOptions
                  isHorizontal
                  data-testid="doc-share-access-request-more-actions"
                  $variation="600"
                />
              </DropdownMenu>
            )}
          </Box>
        }
      />
    </Box>
  );
};

interface QuickSearchGroupAccessRequestProps {
  doc: Doc;
}

export const QuickSearchGroupAccessRequest = ({
  doc,
}: QuickSearchGroupAccessRequestProps) => {
  const { t } = useTranslation();
  const accessRequestQuery = useDocAccessRequestsInfinite({ docId: doc.id });

  const accessRequestsData: QuickSearchData<AccessRequest> = useMemo(() => {
    const accessRequests =
      accessRequestQuery.data?.pages.flatMap((page) => page.results) || [];

    return {
      groupName: t('Access Requests'),
      elements: accessRequests,
      endActions: accessRequestQuery.hasNextPage
        ? [
            {
              content: <LoadMoreText data-testid="load-more-requests" />,
              onSelect: () => void accessRequestQuery.fetchNextPage(),
            },
          ]
        : undefined,
    };
  }, [accessRequestQuery, t]);

  return (
    <Box aria-label={t('List request access card')}>
      <QuickSearchGroup
        group={accessRequestsData}
        renderElement={(accessRequest) => (
          <DocShareAccessRequestItem doc={doc} accessRequest={accessRequest} />
        )}
      />
    </Box>
  );
};
