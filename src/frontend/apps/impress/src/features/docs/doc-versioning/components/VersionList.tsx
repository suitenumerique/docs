import { Loader } from '@gouvfr-lasuite/ui-components';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';

import { APIError } from '@/api';
import { Box, Icon, Text, TextErrors } from '@/components';
import { Doc } from '@/docs/doc-management';
import { useDate } from '@/hooks';

import { useDocActivity } from '../api/useDocActivity';
import { DocVersion } from '../types';

import { VersionItem } from './VersionItem';

/**
 * The timeline's timestamps are unix milliseconds; every date helper here reads
 * ISO strings.
 */
const toISO = (timestamp: number) => new Date(timestamp).toISOString();

interface VersionListStateProps {
  isLoading: boolean;
  error: APIError<unknown> | null;
  versions?: DocVersion[];
  selectedVersionId?: DocVersion['id'];
  onSelectVersion?: (versionId: DocVersion['id']) => void;
}

const VersionListState = ({
  onSelectVersion,
  selectedVersionId,
  isLoading,
  error,
  versions,
}: VersionListStateProps) => {
  const { formatDateSpecial } = useDate();

  if (isLoading) {
    return (
      <Box $align="center" $margin="large">
        <Loader />
      </Box>
    );
  }

  return (
    <Box $gap="xxs" $padding="xs">
      {versions?.map((version) => {
        const formattedDate = formatDateSpecial(
          toISO(version.to),
          'dd MMMM · HH:mm',
        );
        const isSelected = version.id === selectedVersionId;
        return (
          <Box as="li" key={version.id} $css="list-style: none;">
            <VersionItem
              text={formattedDate}
              isActive={isSelected}
              onSelect={() => onSelectVersion?.(version.id)}
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
  onSelectVersion?: (versionId: DocVersion['id']) => void;
  selectedVersionId?: DocVersion['id'];
}

export const VersionList = ({
  doc,
  onSelectVersion,
  selectedVersionId,
}: VersionListProps) => {
  const { t } = useTranslation();
  const { formatDate } = useDate();

  /**
   * The whole list arrives at once — the collaboration server bounds it to the
   * history this user may see, and a version is at least a minute of editing —
   * so there is nothing to page through.
   */
  const {
    data: versions,
    error,
    isLoading,
  } = useDocActivity({ docId: doc.id });

  const selectedVersion = versions?.find(
    (version) => version.id === selectedVersionId,
  );
  const selectedVersionDate = selectedVersion
    ? formatDate(toISO(selectedVersion.to), DateTime.DATETIME_MED)
    : null;

  return (
    <Box
      $css="overflow-y: auto; overflow-x: hidden;"
      className="--docs--version-list"
    >
      <Box as="ul" $padding="none" $margin={{ top: 'none' }} role="list">
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
          selectedVersionId={selectedVersionId}
        />
      </Box>
      <Text className="sr-only" aria-live="polite">
        {selectedVersionDate
          ? t('Selected version {{date}}', { date: selectedVersionDate })
          : ''}
      </Text>
    </Box>
  );
};
