import {
  FileBlockConfig,
  InlineContentSchema,
  StyleSchema,
  insertOrUpdateBlock,
} from '@blocknote/core';
import {
  AddFileButton,
  FileBlockWrapper,
  ReactCustomBlockRenderProps,
  createReactBlockSpec,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';

import { useCheckEmbedCompatibility } from '../../hook/useCheckEmbedCompatibility';
import { DocsBlockNoteEditor } from '../../types';

export const PDFPreview = (
  props: Omit<
    ReactCustomBlockRenderProps<
      FileBlockConfig,
      InlineContentSchema,
      StyleSchema
    >,
    'contentRef'
  >,
) => {
  const { t } = useTranslation();
  const { isCompatible } = useCheckEmbedCompatibility();

  const pdfUrl = props.block.props.url;

  return (
    <>
      {isCompatible ? (
        <embed
          src={pdfUrl}
          type="application/pdf"
          width="100%"
          height="500px"
          contentEditable={false}
          draggable={false}
          onClick={() => props.editor.setTextCursorPosition(props.block)}
          aria-label={props.block.props.name}
        />
      ) : (
        <p>
          {t('Your browser does not support PDFs.')}{' '}
          <a href={pdfUrl}>{t('Download the pdf instead.')}</a>
        </p>
      )}
    </>
  );
};

export const PDFBlock = createReactBlockSpec(
  {
    type: 'pdf',
    propSchema: {
      name: {
        default: '' as const,
      },
      url: {
        default: '' as const,
      },
      caption: {
        default: '' as const,
      },
      showPreview: {
        default: true,
      },
      previewWidth: {
        default: 512,
      },
    },
    content: 'none',
    isFileBlock: true,
  } as const as FileBlockConfig,
  {
    render: (props) => (
      <div ref={props.contentRef} className="bn-file-block-content-wrapper">
        {props.block.props.url === '' ? (
          <AddFileButton
            {...props}
            editor={props.editor}
            buttonText="Add PDF"
            buttonIcon={
              <Text $isMaterialIcon $size="18px">
                upload
              </Text>
            }
          />
        ) : (
          <FileBlockWrapper block={props.block} editor={props.editor}>
            <PDFPreview block={props.block} editor={props.editor} />
          </FileBlockWrapper>
        )}
      </div>
    ),
  },
);

export const getPdfSlackMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('PDF'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'pdf',
      });
    },
    aliases: ['pdf', 'document', 'embed', 'file'],
    group,
    icon: (
      <Text $isMaterialIcon $size="18px">
        upload
      </Text>
    ),
    subtext: t('Embed a pdf file'),
  },
];
