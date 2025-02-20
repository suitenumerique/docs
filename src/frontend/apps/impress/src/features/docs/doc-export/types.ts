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
import { Access } from '../doc-management';

export interface Template {
  id: string;
  abilities: {
    destroy: boolean;
    generate_document: boolean;
    accesses_manage: boolean;
    retrieve: boolean;
    update: boolean;
    partial_update: boolean;
  };
  accesses: Access[];
  title: string;
  is_public: boolean;
  css: string;
  code: string;
}

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
  NoInfer<DocsBlockSchema>,
  NoInfer<DocsInlineContentSchema>,
  NoInfer<DocsStyleSchema>,
  Promise<Paragraph[] | Paragraph | Table> | Paragraph[] | Paragraph | Table,
  ParagraphChild,
  IRunPropertiesOptions,
  TextRun
>;
