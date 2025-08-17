import { insertOrUpdateBlock } from '@blocknote/core';
import {
  AddFileButton,
  FileBlockWrapper,
  createReactBlockSpec,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

type FileBlockEditor = Parameters<typeof AddFileButton>[0]['editor'];

export const PDFBlock = createReactBlockSpec(
  {
    type: 'pdf',
    content: 'none',
    propSchema: {
      name: { default: '' as const },
      url: { default: '' as const },
      caption: { default: '' as const },
      showPreview: { default: true },
      previewWidth: { default: undefined, type: 'number' },
    },
    isFileBlock: true,
  },
  {
    render: ({ editor, block, contentRef }) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { t } = useTranslation();
      const pdfUrl = block.props.url;

      return (
        <div ref={contentRef} className="bn-file-block-content-wrapper">
          {pdfUrl === '' ? (
            <AddFileButton
              block={block}
              editor={editor as FileBlockEditor}
              buttonText="Add PDF"
              buttonIcon={<Icon iconName="upload" $size="18px" />}
            />
          ) : (
            <FileBlockWrapper block={block} editor={editor as FileBlockEditor}>
              <div style={{ width: '100%', height: '500px' }}>
                <embed
                  src={pdfUrl}
                  type="application/pdf"
                  width="100%"
                  height="100%"
                  contentEditable={false}
                  draggable={false}
                  onClick={() => editor.setTextCursorPosition(block)}
                  aria-label={block.props.name}
                />
                <p>
                  {t('Your browser does not support PDFs.')}{' '}
                  <a href={pdfUrl}>{t('Download the pdf instead.')}</a>
                </p>
              </div>
            </FileBlockWrapper>
          )}
        </div>
      );
    },
  },
);

export const getPdfReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('PDF'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, { type: 'pdf' });
    },
    aliases: ['pdf', 'document', 'embed', 'file'],
    group,
    icon: <Icon iconName="upload" $size="18px" />,
    subtext: t('Embed a PDF file'),
  },
];
