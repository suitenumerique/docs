import { Loader } from '@openfun/cunningham-react';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';

import { APIError } from '@/api';
import { Box, BoxButton, InfiniteScroll, Text, TextErrors } from '@/components';
import { Doc } from '@/features/docs/doc-management';
import { useDate } from '@/hook';

import { useDocVersionsInfiniteQuery } from '../api/useDocVersions';
import { Versions } from '../types';

import { VersionItem } from './VersionItem';

interface VersionListStateProps {
  isLoading: boolean;
  error: APIError<unknown> | null;
  versions?: Versions[];
  doc: Doc;
  selectedVersionId?: Versions['version_id'];
  onSelectVersion?: (versionId: Versions['version_id']) => void;
}

const VersionListState = ({
  onSelectVersion,
  selectedVersionId,

  isLoading,
  error,
  versions,
  doc,
}: VersionListStateProps) => {
  const { formatDate } = useDate();

  if (isLoading) {
    return (
      <Box $align="center" $margin="large">
        <Loader />
      </Box>
    );
  }

  return (
    <Box $gap="10px" $padding="xs">
      {versions?.map((version) => (
        <BoxButton
          aria-label="version item"
          className="version-item"
          key={version.version_id}
          onClick={() => {
            onSelectVersion?.(version.version_id);
          }}
        >
          <VersionItem
            versionId={version.version_id}
            text={formatDate(version.last_modified, DateTime.DATETIME_MED)}
            docId={doc.id}
            isActive={version.version_id === selectedVersionId}
          />
        </BoxButton>
      ))}
      {error && (
        <Box
          $justify="center"
          $margin={{ vertical: 'small', horizontal: 'small' }}
        >
          <TextErrors
            causes={error.cause}
            icon={
              error.status === 502 ? (
                <Text $isMaterialIcon $theme="danger">
                  wifi_off
                </Text>
              ) : undefined
            }
          />
        </Box>
      )}
    </Box>
  );
};

interface VersionListProps {
  doc: Doc;
  onSelectVersion?: (versionId: Versions['version_id']) => void;
  selectedVersionId?: Versions['version_id'];
}

export const VersionList = ({
  doc,
  onSelectVersion,
  selectedVersionId,
}: VersionListProps) => {
  const { t } = useTranslation();

  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDocVersionsInfiniteQuery({
    docId: doc.id,
  });

  const versions = data?.pages.reduce((acc, page) => {
    return acc.concat(page.versions);
  }, [] as Versions[]);

  return (
    <Box $css="overflow-y: auto; overflow-x: hidden;">
      <InfiniteScroll
        hasMore={hasNextPage}
        isLoading={isFetchingNextPage}
        next={() => {
          void fetchNextPage();
        }}
        as="ul"
        $padding="none"
        $margin={{ top: 'none' }}
        role="listbox"
      >
        {versions?.length === 0 && (
          <Box $align="center" $margin="large">
            <Text $size="h6" $weight="bold">
              {t('No versions')}
            </Text>
          </Box>
        )}
        <VersionListState
          onSelectVersion={onSelectVersion}
          isLoading={isLoading}
          error={error}
          versions={versions}
          doc={doc}
          selectedVersionId={selectedVersionId}
        />
      </InfiniteScroll>
    </Box>
  );
};
