import { Exporter } from '@blocknote/core';
import {
  IRunPropertiesOptions,
  Paragraph,
  ParagraphChild,
  Table,
  TextRun,
} from 'docx';

import {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../doc-editor';

/**
 * The PDF export is Typst based: every mapping returns Typst markup.
 * Blocks and inline content map to markup, styles to a wrapper of an inner
 * Typst expression.
 */
export type DocsExporterPDF = Exporter<
  NoInfer<DocsBlockSchema>,
  NoInfer<DocsInlineContentSchema>,
  NoInfer<DocsStyleSchema>,
  string,
  string,
  (inner: string) => string,
  string
>;

/**
 * A PDF block mapping that renders the block only, the exporter places its
 * children after it (and not a `{ withChildren }` mapping).
 */
export type DocsBlockMappingPDF<K extends keyof DocsBlockSchema> = Extract<
  DocsExporterPDF['mappings']['blockMapping'][K],
  (...args: never[]) => unknown
>;

export type DocsExporterDocx = Exporter<
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
  Promise<Paragraph[] | Paragraph | Table> | Paragraph[] | Paragraph | Table,
  ParagraphChild,
  IRunPropertiesOptions,
  TextRun
>;

export type DocsExporterODT = Exporter<
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
  React.ReactNode,
  React.ReactNode,
  Record<string, string>,
  React.ReactNode
>;
