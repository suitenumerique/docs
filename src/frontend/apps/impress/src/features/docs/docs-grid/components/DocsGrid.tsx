import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InView } from 'react-intersection-observer';
import { css } from 'styled-components';

import AllDocs from '@/assets/icons/doc-all.svg';
import { Box, Card, Icon, Loading, Text } from '@/components';
import { useInfiniteDocs } from '@/docs/doc-management/api/useDocs';
import { useImport } from '@/docs/doc-management/hooks/useImport';
import { DocDefaultFilter } from '@/docs/doc-management/types';
import DocsIcon from '@/icons/Docs.svg';
import BinIcon from '@/icons/bin.svg';
import { useResponsiveStore } from '@/stores';

import { useInfiniteDocsTrashbin } from '../api';

import { DocGridContentList } from './DocGridContentList';

type DocsGridProps = {
  target?: DocDefaultFilter;
};

export const DocsGrid = ({
  target = DocDefaultFilter.ALL_DOCS,
}: DocsGridProps) => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const {
    getRootProps,
    isPending: isImportPending,
    isEnabled: isImportEnabled,
  } = useImport({
    onDragOver: (dragOver: boolean) => {
      setIsDragOver(dragOver);
    },
  });

  const withUpload =
    (!target ||
      target === DocDefaultFilter.ALL_DOCS ||
      target === DocDefaultFilter.MY_DOCS) &&
    isImportEnabled;

  const { isDesktop, isSmallMobile } = useResponsiveStore();

  const { data, isFetching, isLoading, fetchNextPage, hasNextPage } =
    useDocsQuery(target);

  const docs = useMemo(() => {
    const allDocs = data?.pages.flatMap((page) => page.results) ?? [];
    // Deduplicate documents by ID to prevent the same doc appearing multiple times
    // This can happen when a multiple users are impacting the docs list (creation, update, ...)
    const seenIds = new Set<string>();
    return allDocs.filter((doc) => {
      if (seenIds.has(doc.id)) {
        return false;
      }
      seenIds.add(doc.id);
      return true;
    });
  }, [data?.pages]);

  const loading = isFetching || isLoading;
  const hasDocs = data?.pages.some((page) => page.results.length > 0);
  const loadMore = (inView: boolean) => {
    if (!inView || loading) {
      return;
    }
    void fetchNextPage();
  };

  return (
    <Box
      className="--docs--doc-grid"
      $position="relative"
      $padding={{
        horizontal: isSmallMobile ? '0' : 'sm',
        vertical: isSmallMobile ? '0' : 'sm',
      }}
      $width="100%"
      $maxWidth="960px"
      $minHeight="0"
      $align="center"
    >
      <Card
        data-testid="docs-grid"
        $width="100%"
        $border="none"
        $background="transparent"
        $css={css`
          ${
            isDragOver
              ? `
              border: 2px dashed var(--c--contextuals--border--semantic--brand--primary);
              background-color: var(--c--contextuals--background--semantic--brand--tertiary);
            `
              : ''
          }
        `}
        $padding={{
          bottom: 'md',
        }}
        {...(withUpload
          ? getRootProps({ className: 'dropzone', tabIndex: -1 })
          : {})}
      >
        <DocGridTitleBar target={target} isImportPending={isImportPending} />
        {!hasDocs && !loading && <DocGridNoDocs target={target} />}
        {hasDocs && (
          <Box
            $gap="6px"
            $padding={{ vertical: 'sm', horizontal: isDesktop ? 'md' : 'xs' }}
          >
            <Box
              aria-label={t('Documents grid')}
              $display="grid"
              $css={css`
                grid-template-columns: ${
                  isSmallMobile
                    ? 'minmax(0, 550px) auto'
                    : 'minmax(0, 550px) auto auto'
                };
                column-gap: 20px;
              `}
            >
              <Box
                $display="grid"
                $css={css`
                  grid-column: 1 / -1;
                  grid-template-columns: subgrid;
                `}
                data-testid="docs-grid-header"
                aria-hidden="true"
              >
                <Box $padding={{ all: '3xs' }}>
                  <Text $size="xs" $variation="secondary" $weight="500">
                    {t('Name')}
                  </Text>
                </Box>
                {!isSmallMobile && (
                  <Box $padding={{ vertical: '3xs' }}>
                    <Text $size="xs" $weight="500" $variation="secondary">
                      {DocDefaultFilter.TRASHBIN === target
                        ? t('Days remaining')
                        : t('Last modified')}
                    </Text>
                  </Box>
                )}
              </Box>
              <Box role="list" $display="contents">
                <DocGridContentList docs={docs} />
              </Box>
            </Box>
            {loading && (
              <Loading
                loaderProps={{ size: 'small' }}
                $margin={{ top: 'sm' }}
              />
            )}
            {hasNextPage && !loading && (
              <InView
                data-testid="infinite-scroll-trigger"
                as="div"
                onChange={loadMore}
                style={{ margin: 'auto' }}
              >
                {!isFetching && hasNextPage && (
                  <Button
                    onClick={() => void fetchNextPage()}
                    color="brand"
                    variant="tertiary"
                  >
                    {t('More docs')}
                  </Button>
                )}
              </InView>
            )}
          </Box>
        )}
      </Card>
    </Box>
  );
};

const DocGridTitleBar = ({
  target,
  isImportPending,
}: {
  target: DocDefaultFilter;
  isImportPending: boolean;
}) => {
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();

  let title = t('All docs');
  let icon = <Icon icon={<AllDocs width={24} height={24} />} />;
  if (target === DocDefaultFilter.MY_DOCS) {
    icon = <Icon iconName="lock" />;
    title = t('My docs');
  } else if (target === DocDefaultFilter.SHARED_WITH_ME) {
    icon = <Icon iconName="group" />;
    title = t('Shared with me');
  } else if (target === DocDefaultFilter.TRASHBIN) {
    icon = <Icon iconName="delete" />;
    title = t('Trashbin');
  }

  return (
    <Box
      $direction="row"
      $padding={{
        vertical: 'sm',
        horizontal: isDesktop ? 'md' : 'xs',
      }}
      $align="center"
      $justify="space-between"
    >
      <Box $direction="row" $gap="xs" $align="center">
        {icon}
        <Text as="h2" $size="h4" $margin="none" tabIndex={-1}>
          {title}
        </Text>
        {isImportPending && <Loading loaderProps={{ size: 'small' }} />}
      </Box>
    </Box>
  );
};

const DocGridNoDocs = ({ target }: { target: DocDefaultFilter }) => {
  const { t } = useTranslation();

  return (
    <Box as="p" $padding={{ vertical: 'sm' }} $align="center" $justify="center">
      {[
        DocDefaultFilter.ALL_DOCS,
        DocDefaultFilter.MY_DOCS,
        DocDefaultFilter.SHARED_WITH_ME,
      ].includes(target) && (
        <>
          <DocsIcon width={56} height={56} aria-hidden="true" />
          <Text $size="sm" $weight="700">
            {t('No doc yet')}
          </Text>
          {[DocDefaultFilter.ALL_DOCS, DocDefaultFilter.MY_DOCS].includes(
            target,
          ) && (
            <Text $size="sm" $weight="400" $variation="secondary">
              {t('Your docs will appear here.')}
            </Text>
          )}
          {target === DocDefaultFilter.SHARED_WITH_ME && (
            <Text $size="sm" $weight="400" $variation="secondary">
              {t('Your shared docs will appear here.')}
            </Text>
          )}
        </>
      )}
      {target === DocDefaultFilter.TRASHBIN && (
        <>
          <BinIcon width={56} height={56} aria-hidden="true" />
          <Text $size="sm" $weight="700">
            {t('No doc deleted')}
          </Text>
          <Text $size="sm" $weight="400" $variation="secondary">
            {t('Deleted docs will appear here.')}
          </Text>
        </>
      )}
    </Box>
  );
};

const useDocsQuery = (target: DocDefaultFilter) => {
  const trashbinQuery = useInfiniteDocsTrashbin(
    {
      page: 1,
    },
    {
      enabled: target === DocDefaultFilter.TRASHBIN,
    },
  );

  const docsQuery = useInfiniteDocs(
    {
      page: 1,
      ...(target &&
        target !== DocDefaultFilter.ALL_DOCS && {
          is_creator_me: target === DocDefaultFilter.MY_DOCS,
        }),
    },
    {
      enabled: target !== DocDefaultFilter.TRASHBIN,
    },
  );

  return target === DocDefaultFilter.TRASHBIN ? trashbinQuery : docsQuery;
};
