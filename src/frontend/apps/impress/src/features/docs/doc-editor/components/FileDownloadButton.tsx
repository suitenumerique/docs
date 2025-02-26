import {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
  checkBlockIsFileBlock,
  checkBlockIsFileBlockWithPlaceholder,
} from '@blocknote/core';
import {
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useSelectedBlocks,
} from '@blocknote/react';
import { useCallback, useMemo } from 'react';
import { RiDownload2Fill } from 'react-icons/ri';

import { downloadFile, exportResolveFileUrl } from '../../doc-header/utils';

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

    if (checkBlockIsFileBlock(block, editor)) {
      return block;
    }

    return undefined;
  }, [editor, selectedBlocks]);

  const onClick = useCallback(async () => {
    if (fileBlock && fileBlock.props.url) {
      editor.focus();

      // console.log('fileBlock', fileBlock);
      // const toto = await exportResolveFileUrl(fileBlock.props.url, undefined);
      // console.log('toto', toto);

      const url = fileBlock.props.url as string;

      console.log('unsafe', url.includes('-unsafe'));

      if (!url.includes('-unsafe')) {
        const blob = (await exportResolveFileUrl(url, undefined)) as Blob;

        console.log('blob', blob);

        downloadFile(blob, url.split('/').pop() || 'file');
      } else {
        // const result = window.confirm(
        //   'This file is marked as unsafe. Do you want to download it anyway?',
        // );
        const onConfirm = async () => {
          console.log('onConfirm');
          const blob = (await exportResolveFileUrl(url, undefined)) as Blob;
          downloadFile(blob, url.split('/').pop() || 'file (unsafe)');
        };

        open(onConfirm);
        //open(true);

        // if (result) {
        //   const blob = (await exportResolveFileUrl(url, undefined)) as Blob;

        //   console.log('blob', blob);

        //   downloadFile(blob, url.split('/').pop() || 'file (unsafe)');
        // }
      }
      // const response = await fetch(fileBlock.props.url, {
      //   credentials: 'include',
      // });
      // console.log('response', response.headers.get('x-amz-meta-is_unsafe'));
      // console.log(
      //   'response',
      //   response.headers.forEach((value, name) => console.log(name, value)),
      // );
      //window.open(new URL(fileBlock.props.url, window.location.href));

      // if (!editor.resolveFileUrl) {
      //   window.open(new URL(fileBlock.props.url, window.location.href));
      // } else {
      //   editor
      //     .resolveFileUrl(fileBlock.props.url)
      //     .then((downloadUrl) =>
      //       window.open(new URL(downloadUrl, window.location.href)),
      //     );
      // }
    }
  }, [editor, fileBlock, open]);

  if (
    !fileBlock ||
    checkBlockIsFileBlockWithPlaceholder(fileBlock, editor) ||
    !Components
  ) {
    return null;
  }

  return (
    <>
      <Components.FormattingToolbar.Button
        className="bn-button"
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
