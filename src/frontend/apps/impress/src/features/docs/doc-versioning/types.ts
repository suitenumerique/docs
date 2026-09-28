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
  content: string; // Base64 encoded content
  last_modified: string;
  id: string;
}
