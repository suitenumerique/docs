import { Exporter } from '@blocknote/core';
import { DOCXBlockResult } from '@blocknote/xl-docx-exporter';
import { Link, Text, TextProps } from '@react-pdf/renderer';
import { IRunPropertiesOptions, ParagraphChild, TextRun } from 'docx';

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

export type DocsExporterTypst = Exporter<
  NoInfer<DocsBlockSchema>,
  NoInfer<DocsInlineContentSchema>,
  NoInfer<DocsStyleSchema>,
  string,
  string,
  (inner: string) => string,
  string
>;

export type DocsExporterDocx = Exporter<
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
  DOCXBlockResult,
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
