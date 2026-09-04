/**
 * One entry of the collaboration server's `activity` timeline: a stretch of
 * editing, bounded by the first and last change in it, credited to whoever made
 * them. `from` and `to` are unix milliseconds.
 *
 * `by` is a user id — a Docs user's uuid, or the literal `anonymous` for
 * visitors editing a public document, or `system` for content the migration
 * imported. It is not displayed today; resolving ids to names is its own
 * feature.
 */
export interface ActivityEntry {
  from: number;
  to: number;
  by: string | null;
}

export interface APIActivity {
  activity: ActivityEntry[];
}

/**
 * A version, as the history panel shows it: one entry of the timeline after
 * neighbouring entries have been merged (see `mergeActivityEntries`), with the
 * authors that contributed to it.
 *
 * `id` is `to` as a string — the moment the version ends, which is both what
 * identifies it in the list and what the changeset and the rollback are asked
 * for.
 */
export interface DocVersion {
  id: string;
  from: number;
  to: number;
  by: string[];
}

/**
 * `GET changeset?ydoc=true`: the document as it stood at `to`, as a base64
 * y.js update.
 */
export interface APIChangeset {
  ydoc: string | null;
}
