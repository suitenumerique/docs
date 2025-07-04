import {
  Button,
  ButtonProps,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, BoxButton, Icon, LoadMoreText } from '@/components';
import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';
import { useCunninghamTheme } from '@/cunningham';
import { AccessRequest, Doc } from '@/docs/doc-management/';
import { useAuth } from '@/features/auth';

import {
  useAcceptDocAccessRequest,
  useCreateDocAccessRequest,
  useDeleteDocAccessRequest,
  useDocAccessRequests,
  useDocAccessRequestsInfinite,
} from '../api/useDocAccessRequest';

import { DocRoleDropdown } from './DocRoleDropdown';
import { SearchUserRow } from './SearchUserRow';

const QuickSearchGroupAccessRequestStyle = createGlobalStyle`
  .--docs--share-access-request [cmdk-item][data-selected='true'] {
    background: inherit
  }
`;

type Props = {
  doc: Doc;
  accessRequest: AccessRequest;
};

const DocShareAccessRequestItem = ({ doc, accessRequest }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { spacingsTokens } = useCunninghamTheme();
  const { mutate: acceptDocAccessRequests } = useAcceptDocAccessRequest();
  const [role, setRole] = useState(accessRequest.role);

  const { mutate: removeDocAccess } = useDeleteDocAccessRequest({
    onError: () => {
      toast(t('Error while removing the request.'), VariantType.ERROR, {
        duration: 4000,
      });
    },
  });

  if (!doc.abilities.accesses_view) {
    return null;
  }

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
          <Box $direction="row" $align="center" $gap={spacingsTokens['sm']}>
            <DocRoleDropdown
              currentRole={role}
              onSelectRole={setRole}
              canUpdate={doc.abilities.accesses_manage}
            />
            <Button
              color="tertiary"
              onClick={() =>
                acceptDocAccessRequests({
                  docId: doc.id,
                  accessRequestId: accessRequest.id,
                  role,
                })
              }
              size="small"
            >
              {t('Approve')}
            </Button>

            {doc.abilities.accesses_manage && (
              <BoxButton
                onClick={() =>
                  removeDocAccess({
                    accessRequestId: accessRequest.id,
                    docId: doc.id,
                  })
                }
              >
                <Icon iconName="close" $variation="600" $size="16px" />
              </BoxButton>
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

  if (!accessRequestsData.elements.length) {
    return null;
  }

  return (
    <Box
      aria-label={t('List request access card')}
      className="--docs--share-access-request"
    >
      <QuickSearchGroupAccessRequestStyle />
      <QuickSearchGroup
        group={accessRequestsData}
        renderElement={(accessRequest) => (
          <DocShareAccessRequestItem doc={doc} accessRequest={accessRequest} />
        )}
      />
    </Box>
  );
};

type ButtonAccessRequestProps = {
  docId: Doc['id'];
} & ButtonProps;

export const ButtonAccessRequest = ({
  docId,
  ...buttonProps
}: ButtonAccessRequestProps) => {
  const { authenticated } = useAuth();
  const { data: requests } = useDocAccessRequests({
    docId,
    page: 1,
  });
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { mutate: createRequest } = useCreateDocAccessRequest({
    onSuccess: () => {
      toast(t('Access request sent successfully.'), VariantType.SUCCESS, {
        duration: 3000,
      });
    },
  });

  const hasRequested = !!(
    requests && requests?.results.find((request) => request.document === docId)
  );

  if (!authenticated) {
    return null;
  }

  return (
    <Button
      onClick={() => createRequest({ docId })}
      disabled={hasRequested}
      {...buttonProps}
    >
      {buttonProps.children || t('Request access')}
    </Button>
  );
};
