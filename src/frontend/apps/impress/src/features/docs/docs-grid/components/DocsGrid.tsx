import {
  Button,
  Tooltip as TooltipBase,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { InView } from 'react-intersection-observer';
import styled, { css } from 'styled-components';

import AllDocs from '@/assets/icons/doc-all.svg';
import { Box, Card, Icon, Text } from '@/components';
import { DocDefaultFilter, useInfiniteDocs } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { useInfiniteDocsTrashbin } from '../api';
import { ContentTypesAllowed, useImportDoc } from '../api/useImportDoc';
import { useResponsiveDocGrid } from '../hooks/useResponsiveDocGrid';

import {
  DocGridContentList,
  DraggableDocGridContentList,
} from './DocGridContentList';
import { DocsGridLoader } from './DocsGridLoader';

const Tooltip = styled(TooltipBase)`
  & {
    max-width: 200px;

    .c__tooltip__content {
      max-width: 200px;
      width: max-content;
    }
  }
`;

type DocsGridProps = {
  target?: DocDefaultFilter;
};

export const DocsGrid = ({
  target = DocDefaultFilter.ALL_DOCS,
}: DocsGridProps) => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToastProvider();

  const MAX_FILE_SIZE = {
    bytes: 10 * 1024 * 1024, // 10 MB
    text: '10MB',
  };

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: {
      [ContentTypesAllowed.Docx]: ['.docx'],
      [ContentTypesAllowed.Markdown]: ['.md'],
    },
    maxSize: MAX_FILE_SIZE.bytes,
    onDrop(acceptedFiles) {
      setIsDragOver(false);
      for (const file of acceptedFiles) {
        importDoc(file);
      }
    },
    onDragEnter: () => {
      setIsDragOver(true);
    },
    onDragLeave: () => {
      setIsDragOver(false);
    },
    onDropRejected(fileRejections) {
      fileRejections.forEach((rejection) => {
        const isFileTooLarge = rejection.errors.some(
          (error) => error.code === 'file-too-large',
        );

        if (isFileTooLarge) {
          toast(
            t(
              'The document "{{documentName}}" is too large. Maximum file size is {{maxFileSize}}.',
              {
                documentName: rejection.file.name,
                maxFileSize: MAX_FILE_SIZE.text,
              },
            ),
            VariantType.ERROR,
          );
        } else {
          toast(
            t(
              `The document "{{documentName}}" import has failed (only .docx and .md files are allowed)`,
              {
                documentName: rejection.file.name,
              },
            ),
            VariantType.ERROR,
          );
        }
      });
    },
    noClick: true,
  });
  const { mutate: importDoc } = useImportDoc();

  const withUpload =
    !target ||
    target === DocDefaultFilter.ALL_DOCS ||
    target === DocDefaultFilter.MY_DOCS;

  const { isDesktop } = useResponsiveStore();
  const { flexLeft, flexRight } = useResponsiveDocGrid();

  const {
    data,
    isFetching,
    isRefetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useDocsQuery(target);

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
      $position="relative"
      $width="100%"
      $maxWidth="960px"
      $maxHeight="calc(100vh - 52px - 2rem)"
      $align="center"
      className="--docs--doc-grid"
    >
      <DocsGridLoader isLoading={isRefetching || loading} />
      <Card
        data-testid="docs-grid"
        $height="100%"
        $width="100%"
        $css={css`
          ${!isDesktop ? 'border: none;' : ''}
          ${isDragOver
            ? `
              border: 2px dashed var(--c--contextuals--border--semantic--brand--primary);
              background-color: var(--c--contextuals--background--semantic--brand--tertiary);
            `
            : ''}
        `}
        $padding={{
          bottom: 'md',
        }}
        {...(withUpload ? getRootProps({ className: 'dropzone' }) : {})}
      >
        {withUpload && <input {...getInputProps()} />}
        <DocGridTitleBar
          target={target}
          onUploadClick={open}
          withUpload={withUpload}
        />

        {!hasDocs && !loading && (
          <Box $padding={{ vertical: 'sm' }} $align="center" $justify="center">
            <Text $size="sm" $weight="700">
              {t('No documents found')}
            </Text>
          </Box>
        )}
        {hasDocs && (
          <Box
            $gap="6px"
            $overflow="auto"
            $padding={{ vertical: 'sm', horizontal: isDesktop ? 'md' : 'xs' }}
          >
            <Box role="grid" aria-label={t('Documents grid')}>
              <Box role="rowgroup">
                <Box
                  $direction="row"
                  $padding={{ horizontal: 'xs' }}
                  $gap="10px"
                  data-testid="docs-grid-header"
                  role="row"
                >
                  <Box $flex={flexLeft} $padding="3xs" role="columnheader">
                    <Text $size="xs" $variation="secondary" $weight="500">
                      {t('Name')}
                    </Text>
                  </Box>
                  {isDesktop && (
                    <Box
                      $flex={flexRight}
                      $padding={{ vertical: '3xs' }}
                      role="columnheader"
                    >
                      <Text $size="xs" $weight="500" $variation="secondary">
                        {DocDefaultFilter.TRASHBIN === target
                          ? t('Days remaining')
                          : t('Updated at')}
                      </Text>
                    </Box>
                  )}
                </Box>
              </Box>
              <Box role="rowgroup">
                {isDesktop ? (
                  <DraggableDocGridContentList docs={docs} />
                ) : (
                  <DocGridContentList docs={docs} />
                )}
              </Box>
            </Box>
            {hasNextPage && !loading && (
              <InView
                data-testid="infinite-scroll-trigger"
                as="div"
                onChange={loadMore}
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
  onUploadClick,
  withUpload,
}: {
  target: DocDefaultFilter;
  onUploadClick: () => void;
  withUpload: boolean;
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
        vertical: 'md',
        horizontal: isDesktop ? 'md' : 'xs',
      }}
      $css={css`
        border-bottom: 1px solid var(--c--contextuals--border--surface--primary);
      `}
      $align="center"
      $justify="space-between"
    >
      <Box $direction="row" $gap="xs" $align="center">
        {icon}
        <Text as="h2" $size="h4" $margin="none">
          {title}
        </Text>
      </Box>
      {withUpload && (
        <Tooltip
          content={
            <Text $textAlign="center" $theme="neutral" $variation="tertiary">
              {t('Import Docx or Markdown files')}
            </Text>
          }
        >
          <Button
            color="brand"
            variant="tertiary"
            onClick={(e) => {
              e.stopPropagation();
              onUploadClick();
            }}
            aria-label={t('Open the upload dialog')}
          >
            <Icon iconName="upload_file" $withThemeInherited />
          </Button>
        </Tooltip>
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
