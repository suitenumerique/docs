/**
 * Copy of Blocknote's default FilePanel, restricted to hide the "Upload" tab
 * for blocks whose props explicitly set `uploadDisabled: true` (e.g. the
 * "embed" block, which only supports embedding an existing URL).
 *
 * Original source:
 * https://github.com/TypeCellOS/BlockNote/blob/main/packages/react/src/components/FilePanel/FilePanel.tsx
 */
import {
  EmbedTab,
  FilePanelProps,
  UploadTab,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
} from '@blocknote/react';
import { useState } from 'react';

import {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

export const DocsFilePanel = (
  props: FilePanelProps & Partial<{ defaultOpenTab: string }>,
) => {
  const Components = useComponentsContext();
  const dict = useDictionary();

  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();

  const [loading, setLoading] = useState<boolean>(false);

  const block = editor.getBlock(props.blockId);
  const uploadDisabled =
    !!block &&
    'uploadDisabled' in block.props &&
    block.props.uploadDisabled === true;
  const allowUpload = editor.uploadFile !== undefined && !uploadDisabled;

  const tabs = [
    ...(allowUpload
      ? [
          {
            name: dict.file_panel.upload.title,
            tabPanel: (
              <UploadTab blockId={props.blockId} setLoading={setLoading} />
            ),
          },
        ]
      : []),
    {
      name: dict.file_panel.embed.title,
      tabPanel: <EmbedTab blockId={props.blockId} />,
    },
  ];

  const [openTab, setOpenTab] = useState<string>(
    props.defaultOpenTab || tabs[0].name,
  );

  if (!Components) {
    return null;
  }

  return (
    <Components.FilePanel.Root
      className="bn-panel"
      defaultOpenTab={openTab}
      openTab={openTab}
      setOpenTab={setOpenTab}
      tabs={tabs}
      loading={loading}
    />
  );
};
