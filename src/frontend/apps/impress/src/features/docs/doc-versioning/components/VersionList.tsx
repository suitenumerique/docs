import { Loader } from '@gouvfr-lasuite/cunningham-react';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';

import { APIError } from '@/api';
import { Box, Icon, InfiniteScroll, Text, TextErrors } from '@/components';
import { Doc } from '@/docs/doc-management';
import { useDate } from '@/hooks';

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
      {versions?.map((version) => {
        const formattedDate = formatDate(
          version.last_modified,
          DateTime.DATETIME_MED,
        );
        const isSelected = version.version_id === selectedVersionId;
        return (
          <Box as="li" key={version.version_id} $css="list-style: none;">
            <VersionItem
              versionId={version.version_id}
              text={formattedDate}
              docId={doc.id}
              isActive={isSelected}
              onSelect={() => onSelectVersion?.(version.version_id)}
            />
          </Box>
        );
      })}
      {error && (
        <Box
          $justify="center"
          $margin={{ vertical: 'small', horizontal: 'small' }}
        >
          <TextErrors
            causes={error.cause}
            icon={
              error.status === 502 ? (
                <Icon iconName="wifi_off" $theme="danger" />
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
  const { formatDate } = useDate();

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
  const selectedVersion = versions?.find(
    (version) => version.version_id === selectedVersionId,
  );
  const selectedVersionDate = selectedVersion
    ? formatDate(selectedVersion.last_modified, DateTime.DATETIME_MED)
    : null;

  return (
    <Box
      $css="overflow-y: auto; overflow-x: hidden;"
      className="--docs--version-list"
    >
      <InfiniteScroll
        hasMore={hasNextPage}
        isLoading={isFetchingNextPage}
        next={() => {
          void fetchNextPage();
        }}
        as="ul"
        $padding="none"
        $margin={{ top: 'none' }}
        role="list"
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
      <Text className="sr-only" aria-live="polite">
        {selectedVersionDate
          ? t('Selected version {{date}}', { date: selectedVersionDate })
          : ''}
      </Text>
    </Box>
  );
};
