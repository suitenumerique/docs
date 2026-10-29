export type Version = [major: number, minor: number, patch: number];

const VERSION_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

/**
 * Parse the `major.minor.patch` of a version, a leading `v` is accepted and a
 * pre-release or build suffix is ignored.
 * @returns the version, or `null` if it cannot be parsed (e.g. the backend "NA")
 */
export const parseVersion = (version: string): Version | null => {
  const match = VERSION_REGEX.exec(version.trim());
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/**
 * Whether the frontend is older than the backend, the only case where a reload
 * can fetch a frontend matching the backend.
 * Unparsable versions (e.g. the backend's "NA") are never considered behind.
 */
export const isFrontendBehindBackend = (
  frontendVersion: string,
  backendVersion: string,
): boolean => {
  const frontend = parseVersion(frontendVersion);
  const backend = parseVersion(backendVersion);
  if (!frontend || !backend) {
    return false;
  }

  const index = frontend.findIndex((part, i) => part !== backend[i]);
  return index !== -1 && frontend[index] < backend[index];
};
