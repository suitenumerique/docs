import { en } from '@blocknote/core/locales';

/** Shared by version diffs and suggestions; keep authorless labels intact. */
export const authorOnlyAttribution = (
  base: typeof en.suggestion_changes,
): typeof en.suggestion_changes => ({
  ...base,
  inserted_by: (users: string) => users,
  deleted_by: (users: string) => users,
});
