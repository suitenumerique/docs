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

  test('replaces characters rejected by Windows filesystems', () => {
    expect(getExportFilename('Q1: Sales * Draft? <Final> | "Notes"')).toBe(
      'q1--sales---draft---final-----notes-',
    );
  });

  test.each(['CON', 'nul.txt', 'COM1', 'lpt9.log'])(
    'protects the reserved Windows device name %s',
    (title) => {
      expect(getExportFilename(title)).toBe(`_${title.toLowerCase()}`);
    },
  );

  test('trims trailing spaces and dots', () => {
    expect(getExportFilename('Quarterly report...   ')).toBe(
      'quarterly-report',
    );
  });

  test('uses a fallback when sanitization removes the title', () => {
    expect(getExportFilename('...')).toBe('document');
  });
});
