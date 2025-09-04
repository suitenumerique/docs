import { describe, expect, it } from 'vitest';

import { utilTable } from '../blocks-mapping/tablePDF';

/**
 * Tests for utilTable utility.
 * Scenarios covered:
 *  - All widths specified and below full width
 *  - Mix of known / unknown widths (fallback distribution)
 *  - All widths unknown
 *  - Widths exceeding full table width (clamping & scale=100)
 *  - Sum exceeding full width without unknowns (no division by zero side-effects)
 */

describe('utilTable', () => {
  it('returns unchanged widths and correct scale when all widths are known and below full width', () => {
    const input = [165, 200];
    const { columnWidths, tableScale } = utilTable(730, input);
    expect(columnWidths).toEqual(input); // unchanged
    expect(tableScale).toBe(50);
  });

  it('distributes fallback width equally among unknown columns', () => {
    const input: (number | undefined)[] = [100, undefined, 200, undefined];
    const { columnWidths, tableScale } = utilTable(730, input);
    expect(columnWidths).toEqual([100, 215, 200, 215]);
    expect(tableScale).toBe(100); // fills full width exactly
  });

  it('handles all columns unknown', () => {
    const input: (number | undefined)[] = [undefined, undefined];
    const { columnWidths, tableScale } = utilTable(730, input);
    expect(columnWidths).toEqual([365, 365]);
    expect(tableScale).toBe(100);
  });

  it('clamps total width to full width when sum exceeds it (single large column)', () => {
    const input = [800];
    const { columnWidths, tableScale } = utilTable(730, input);
    expect(columnWidths).toEqual([800]);
    expect(tableScale).toBe(100);
  });

  it('clamps total width to full width when multiple columns exceed it', () => {
    const input = [500, 300]; // sum = 800 > 730
    const { columnWidths, tableScale } = utilTable(730, input);
    expect(columnWidths).toEqual([500, 300]);
    expect(tableScale).toBe(100);
  });

  it('does not assign fallback when there are no unknown widths (avoid division by zero impact)', () => {
    const input = [400, 400];
    const { columnWidths, tableScale } = utilTable(730, input);
    expect(columnWidths).toEqual([400, 400]);
    expect(tableScale).toBe(100);
  });

  it('computes proportional scale with custom fullWidth', () => {
    const input = [100, 200]; // total 300
    const { columnWidths, tableScale } = utilTable(1000, input);
    expect(columnWidths).toEqual([100, 200]);
    expect(tableScale).toBe(30);
  });
});
