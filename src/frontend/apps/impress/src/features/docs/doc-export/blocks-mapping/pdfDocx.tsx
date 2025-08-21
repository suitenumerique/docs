import { Paragraph, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';

export const blockMappingPdfDocx: DocsExporterDocx['mappings']['blockMapping']['pdf'] =
  (block) => {
    const pdfName = block.props.name || 'PDF Document';
    const pdfUrl = block.props.url;

    const children: TextRun[] = [
      new TextRun({
        text: '📄 ',
        size: 20,
      }),
      new TextRun({
        text: pdfName,
        bold: true,
        size: 24,
      }),
    ];

    if (pdfUrl) {
      children.push(
        new TextRun({
          text: '\nSource: ',
          size: 20,
          color: '666666',
        }),
        new TextRun({
          text: pdfUrl,
          size: 20,
          color: '666666',
        }),
      );
    }

    children.push(
      new TextRun({
        text: '\n[PDF content cannot be embedded in exported DOCX]',
        size: 18,
        color: '999999',
        italics: true,
      }),
    );

    return new Paragraph({
      children,
      spacing: {
        before: 200,
        after: 200,
      },
      border: {
        top: { size: 1, color: 'CCCCCC', style: 'single' },
        bottom: { size: 1, color: 'CCCCCC', style: 'single' },
        left: { size: 1, color: 'CCCCCC', style: 'single' },
        right: { size: 1, color: 'CCCCCC', style: 'single' },
      },
      shading: {
        fill: 'F9F9F9',
      },
    });
  };
