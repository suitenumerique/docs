import { Exporter } from '@blocknote/core';
import { Link, Text, TextProps } from '@react-pdf/renderer';
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

export type DocsExporterPDF = Exporter<
  NoInfer<DocsBlockSchema>,
  NoInfer<DocsInlineContentSchema>,
  NoInfer<DocsStyleSchema>,
  React.ReactElement<Text>,
  React.ReactElement<Link> | React.ReactElement<Text>,
  TextProps['style'],
  React.ReactElement<Text>
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
