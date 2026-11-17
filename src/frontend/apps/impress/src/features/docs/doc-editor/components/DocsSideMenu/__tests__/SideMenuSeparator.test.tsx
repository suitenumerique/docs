import {
  BlockNoteEditor,
  BlockNoteSchema,
  defaultBlockSpecs,
} from '@blocknote/core';
import { createReactDiagramBlockSpec } from '@blocknote/diagram-block';
import { createReactMathBlockSpec } from '@blocknote/math-block';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { SideMenuSeparator } from '../SideMenuSeparator';

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    diagram: createReactDiagramBlockSpec(),
    mathBlock: createReactMathBlockSpec(),
  },
});

// What the mocked hooks return: the editor and the block the side menu is on
const sideMenu = vi.hoisted((): { editor?: unknown; block?: unknown } => ({}));

vi.mock('@blocknote/react', async () => ({
  ...(await vi.importActual<typeof import('@blocknote/react')>(
    '@blocknote/react',
  )),
  useBlockNoteEditor: () => sideMenu.editor,
  useExtensionState: () => sideMenu.block,
}));

const renderFor = (type: string) => {
  const editor = BlockNoteEditor.create({
    schema,
    initialContent: [{ id: 'block', type } as never],
  });
  sideMenu.editor = editor;
  sideMenu.block = editor.getBlock('block');

  return render(<SideMenuSeparator hideWithoutColors />, {
    wrapper: AppWrapper,
  });
};

describe('SideMenuSeparator with hideWithoutColors', () => {
  afterEach(() => {
    sideMenu.editor = undefined;
    sideMenu.block = undefined;
  });

  it.each(['paragraph', 'heading', 'bulletListItem'])(
    'shows the separator after "Colors" on a %s block',
    (type) => {
      renderFor(type);

      expect(screen.getByRole('separator')).toBeInTheDocument();
    },
  );

  it.each(['mathBlock', 'diagram', 'codeBlock'])(
    'hides the separator on a %s block, which has no colors',
    (type) => {
      renderFor(type);

      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    },
  );

  it('hides the separator when no block is hovered', () => {
    sideMenu.block = undefined;

    render(<SideMenuSeparator hideWithoutColors />, { wrapper: AppWrapper });

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });
});
