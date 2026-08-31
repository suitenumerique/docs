import { describe, expect, it } from 'vitest';

import { ActivityEntry } from '../types';
import { VERSION_GRANULARITY_MS, mergeActivityEntries } from '../utils';

/**
 * `mergeActivityEntries` is the only part of the history policy that lives in
 * the client, and it decides what a "version" is. The cases below are the ones
 * it can plausibly get wrong: the two bounds, each of which is a strict
 * comparison, and the author test that this deliberately does *not* apply.
 */
const entry = (from: number, to: number, by: string | null): ActivityEntry => ({
  from,
  to,
  by,
});

const G = VERSION_GRANULARITY_MS;

describe('mergeActivityEntries', () => {
  it('has nothing to say about an empty timeline', () => {
    expect(mergeActivityEntries([])).toEqual([]);
  });

  it('merges changes closer together than the granularity', () => {
    const versions = mergeActivityEntries([
      entry(0, 0, 'alice'),
      entry(1_000, 1_000, 'alice'),
    ]);

    expect(versions).toEqual([
      { id: '1000', from: 0, to: 1_000, by: ['alice'] },
    ]);
  });

  it('merges across authors, which the server will not do', () => {
    // the reason this function exists: the collaboration server breaks a run
    // wherever the author changes, and a version is a moment in the document
    // rather than a moment in one person's editing
    const versions = mergeActivityEntries([
      entry(0, 0, 'alice'),
      entry(1_000, 1_000, 'bob'),
      entry(2_000, 2_000, 'alice'),
    ]);

    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ from: 0, to: 2_000 });
    expect(versions[0].by.sort()).toEqual(['alice', 'bob']);
  });

  it('starts a new version after a gap of exactly the granularity', () => {
    // `<`, not `<=` — the same comparison the server makes, so the two halves
    // of the grouping cannot disagree at the boundary
    expect(
      mergeActivityEntries([entry(0, 0, 'a'), entry(G, G, 'a')]),
    ).toHaveLength(2);
    expect(
      mergeActivityEntries([entry(0, 0, 'a'), entry(G - 1, G - 1, 'a')]),
    ).toHaveLength(1);
  });

  it('never lets one version span more than the granularity', () => {
    // unbroken typing: every change is a millisecond after the last, so no gap
    // ever ends a version and only the span bound can
    const timeline = Array.from({ length: 5 }, (_, i) =>
      entry(i * (G / 2), i * (G / 2), 'alice'),
    );

    const versions = mergeActivityEntries(timeline);

    expect(versions.length).toBeGreaterThan(1);
    versions.forEach((version) => {
      expect(version.to - version.from).toBeLessThan(G);
    });
  });

  it('identifies a version by the moment it ends', () => {
    // that id is what the preview and the restore are asked for, so it has to
    // survive merging rather than being the first entry's timestamp
    const [version] = mergeActivityEntries([
      entry(0, 0, 'alice'),
      entry(500, 900, 'alice'),
    ]);

    expect(version.id).toBe('900');
    expect(version.to).toBe(900);
  });

  it('keeps an unattributed change without inventing an author', () => {
    const [version] = mergeActivityEntries([entry(0, 0, null)]);

    expect(version.by).toEqual([]);
  });
});
