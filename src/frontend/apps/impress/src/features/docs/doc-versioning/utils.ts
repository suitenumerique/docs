import { ActivityEntry, DocVersion } from './types';

/**
 * How coarse the version history is: neighbouring changes closer together than
 * this become one version, and no version spans more than this.
 *
 * A minute is a deliberate choice about what a "version" means here. The
 * collaboration server records an activity entry per stretch of editing, which
 * at typing speed is far finer than anything worth listing — a history of every
 * few keystrokes is not a history.
 */
export const VERSION_GRANULARITY_MS = 60_000;

/**
 * Merge an ascending activity timeline into the versions the panel lists.
 *
 * The collaboration server already groups with the same two bounds (a gap and a
 * maximum span, both a minute), but it will only ever merge changes by the
 * *same* author: it breaks a run whenever the author changes. Two people typing
 * in the same paragraph at the same time would otherwise produce two interleaved
 * columns of entries, which is not what a version is — a version is a moment in
 * the document, not a moment in someone's editing.
 *
 * So this applies the server's own rule again, minus the author test, and keeps
 * the authors instead of discarding them. Because the server sorts by `from` and
 * breaks a run only where the author changes, re-merging those adjacent runs
 * yields exactly what one pass over the whole timeline would have produced.
 *
 * Both comparisons are `<`, matching the server's, so entries exactly a minute
 * apart start a new version rather than joining the old one.
 */
export const mergeActivityEntries = (
  activity: ActivityEntry[],
  granularityMs: number = VERSION_GRANULARITY_MS,
): DocVersion[] => {
  const versions: DocVersion[] = [];
  const authors: Set<string>[] = [];

  activity.forEach((entry) => {
    const last = versions[versions.length - 1];

    if (
      last &&
      entry.from - last.to < granularityMs &&
      entry.to - last.from < granularityMs
    ) {
      last.to = entry.to;
      last.id = String(entry.to);
    } else {
      versions.push({
        id: String(entry.to),
        from: entry.from,
        to: entry.to,
        by: [],
      });
      authors.push(new Set());
    }

    if (entry.by) {
      authors[authors.length - 1].add(entry.by);
    }
  });

  return versions.map((version, index) => ({
    ...version,
    by: Array.from(authors[index]),
  }));
};
