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
 * Authors whose changes are never merged into a version with anything else.
 *
 * `system` is not a person who edited for a long time; it is what a document's
 * imported past is attributed to. The backend used to save the whole document
 * once a minute, each save becoming one version of the legacy file, and the
 * migration replays those saves at their original timestamps — so an imported
 * history arrives as a chain of `system` entries spaced almost exactly the
 * granularity apart. Grouped like ordinary editing, whether two of those
 * versions survive as two would come down to how fast the network was on the
 * day they were written, and about a third of the chain would collapse.
 *
 * Grouping is a judgement about someone's editing, and there was no editing
 * here: these entries are the record of saves that already happened, and the
 * only honest thing to do with them is to show them one for one.
 */
export const UNGROUPED_AUTHORS = ['system'];

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
 *
 * `UNGROUPED_AUTHORS` is honoured on both sides, which is stricter than the
 * server's own test and has to be: the server only refuses to merge an excluded
 * entry into the one before it, because it would have refused anyway on the
 * author test it makes and this does not. Here an excluded entry both starts a
 * version and closes it, so an edit made moments after a document was migrated
 * cannot be folded into the imported history it happens to sit next to.
 */
export const mergeActivityEntries = (
  activity: ActivityEntry[],
  granularityMs: number = VERSION_GRANULARITY_MS,
): DocVersion[] => {
  const versions: DocVersion[] = [];
  const authors: Set<string>[] = [];
  const isUngrouped = (by: string | null) =>
    by !== null && UNGROUPED_AUTHORS.includes(by);

  activity.forEach((entry) => {
    const last = versions[versions.length - 1];
    const lastAuthors = authors[authors.length - 1];

    if (
      last &&
      !isUngrouped(entry.by) &&
      !Array.from(lastAuthors ?? []).some(isUngrouped) &&
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
