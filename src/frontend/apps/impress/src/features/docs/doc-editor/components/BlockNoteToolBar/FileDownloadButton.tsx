/**
 * We added some custom logic to the original Blocknote FileDownloadButton
 * component to handle our file download use case.
 *
 * Original source:
 * https://github.com/TypeCellOS/BlockNote/blob/main/packages/react/src/components/FormattingToolbar/DefaultButtons/FileDownloadButton.tsx
 */

import {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
  blockHasType,
} from '@blocknote/core';
import {
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useSelectedBlocks,
} from '@blocknote/react';
import { useCallback, useMemo } from 'react';
import { RiDownload2Fill } from 'react-icons/ri';

import { downloadFile, exportResolveFileUrl } from '@/docs/doc-export';
import { isSafeUrl } from '@/utils/url';

export const FileDownloadButton = ({
  open,
}: {
  open: (onConfirm: () => Promise<void> | void) => void;
}) => {
  const dict = useDictionary();
  const Components = useComponentsContext();

  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >();

  const selectedBlocks = useSelectedBlocks(editor);

  const fileBlock = useMemo(() => {
    // Checks if only one block is selected.
    if (selectedBlocks.length !== 1) {
      return undefined;
    }

    const block = selectedBlocks[0];

    if (
      blockHasType(block, editor, block.type, { url: 'string', name: 'string' })
    ) {
      return block;
    }

    return undefined;
  }, [editor, selectedBlocks]);

  const onClick = useCallback(async () => {
    if (fileBlock && fileBlock.props.url) {
      editor.focus();

      const url = fileBlock.props.url as string;
      const name = fileBlock.props.name as string | undefined;

      /**
       * If not hosted on our domain, means not a file uploaded by the user,
       * we do what Blocknote was doing initially.
       */
      if (!url.includes(window.location.hostname) && !url.includes('base64')) {
        if (!editor.resolveFileUrl) {
          if (!isSafeUrl(url)) {
            return;
          }

          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          void editor
            .resolveFileUrl(url)
            .then((downloadUrl) => window.open(downloadUrl));
        }

        return;
      }

      if (!url.includes('-unsafe')) {
        const blob = (await exportResolveFileUrl(url)) as Blob;
        downloadFile(blob, name || url.split('/').pop() || 'file');
      } else {
        const onConfirm = async () => {
          const blob = (await exportResolveFileUrl(url)) as Blob;

          const baseName = name || url.split('/').pop() || 'file';

          const regFindLastDot = /(\.[^/.]+)$/;
          const unsafeName = baseName.includes('.')
            ? baseName.replace(regFindLastDot, '-unsafe$1')
            : baseName + '-unsafe';

          downloadFile(blob, unsafeName);
        };

        open(onConfirm);
      }
    }
  }, [editor, fileBlock, open]);

  if (!fileBlock || fileBlock.props.url === '' || !Components) {
    return null;
  }

  return (
    <>
      <Components.FormattingToolbar.Button
        className="bn-button --docs--editor-file-download-button"
        data-test="downloadfile"
        label={
          dict.formatting_toolbar.file_download.tooltip[fileBlock.type] ||
          dict.formatting_toolbar.file_download.tooltip['file']
        }
        mainTooltip={
          dict.formatting_toolbar.file_download.tooltip[fileBlock.type] ||
          dict.formatting_toolbar.file_download.tooltip['file']
        }
        icon={<RiDownload2Fill />}
        onClick={() => void onClick()}
      />
    </>
  );
};
