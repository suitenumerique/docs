import { Doc } from '../doc-management/types';

export interface APIListVersions {
  count: number;
  is_truncated: boolean;
  next_version_id_marker: string | null;
  versions: Versions[];
}

export interface Versions {
  etag: string;
  is_latest: boolean;
  last_modified: string;
  version_id: string;
}

export interface Version {
  content: Doc['content'];
  last_modified: string;
  id: string;
}

export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

export type VersionSelectMode = 'view' | 'compare';

export interface InlineContentDiff {
  diffType: DiffType;
  text: string;
  styles?: Record<string, boolean>;
}

export interface DiffBlock {
  diffType: DiffType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block: any;
  contentDiff?: InlineContentDiff[];
  childrenDiff?: DiffBlock[];
  propsChanged?: boolean;
}
