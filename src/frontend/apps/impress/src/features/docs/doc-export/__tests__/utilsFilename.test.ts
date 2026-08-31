import { describe, expect, test } from 'vitest';

import { getExportFilename } from '../utils';

describe('getExportFilename', () => {
  test('normalizes document titles for export', () => {
    expect(getExportFilename('R\u00e9sum\u00e9 Roadmap')).toBe(
      'resume-roadmap',
    );
  });

  test('replaces archive path separators', () => {
    expect(getExportFilename('Roadmap/2026\\Final')).toBe('roadmap-2026-final');
  });
});
