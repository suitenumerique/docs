import { ResolvedPos } from 'prosemirror-model';
import { EditorState, Selection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useEffect, useState } from 'react';

import { DocsBlockNoteEditor } from '../types';

const UP = 'ArrowUp',
  RIGHT = 'ArrowRight',
  DOWN = 'ArrowDown',
  LEFT = 'ArrowLeft';

const lastLine = (
  state: EditorState,
  view: EditorView,
  resolved: ResolvedPos,
): { lStart: number; lLen: number } => {
  // returns the starting position and length of a callout's last
  // line.
  const start = resolved.start(resolved.depth);

  const { doc, selection } = state;
  let pos = selection.anchor - 3;

  const { top } = view.coordsAtPos(pos);
  let l = 0;

  while (view.coordsAtPos(--pos).top == top && pos > start) {
    l++;
  }

  return {
    lStart: start + doc.resolve(pos).parent.textContent.length - l,
    lLen: l,
  };
};

const lastLineOffset = (
  view: EditorView,
  selection: Selection | null,
): number => {
  // returns the selection's offset relatively to the
  // last line's start of a callout block.

  if (!selection) {
    return 0;
  }

  let i = 0;
  let { anchor } = selection;
  const { top } = view.coordsAtPos(anchor);

  while (view.coordsAtPos(--anchor).top == top && anchor > 0) {
    i++;
  }

  return i;
};

type InputState = {
  lastKeyCode: number;
};

interface PmEditorView extends EditorView {
  input: InputState;
}

export const useCalloutBlock = (editor: DocsBlockNoteEditor) => {
  // Hacks to fix cursor behavior between and around callout blocks.
  //
  // Navigating backwards (arrow up or arrow left at the start of
  // a callout) will create a GapCursor (prosemirror-gapcursor) instance
  // on top of the block when it is wether the first block of the
  // document or preceded by another callout block. Same behavior to be
  // expected when navigating forwards (arrow down or arrow right).
  //
  // This hook defines where the cursor should go (setting the
  // selection) by looking for the next valid text node.

  const [prevSelection, setPrevSelection] = useState<Selection | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const view = editor.prosemirrorView as PmEditorView;
      const lastKeyCode = view.input?.lastKeyCode;

      if (![38, 40].includes(lastKeyCode)) {
        setPrevSelection(editor.prosemirrorState.selection);
      }
    };

    editor.onSelectionChange(handleSelectionChange);
  }, [prevSelection, editor]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const { code } = e;
      if (![UP, DOWN, LEFT, RIGHT].includes(code)) {
        return;
      }

      editor.exec((state, dispatch, view) => {
        if (!view) {
          return false;
        }

        const { doc, selection, tr } = state;
        const { $anchor } = selection;
        let { pos } = $anchor;

        const start = $anchor.start($anchor.depth);
        const end = $anchor.end($anchor.depth);

        switch (code) {
          case UP:
            if (pos > start && pos < end) {
              return false;
            }

            if (!editor.getTextCursorPosition().prevBlock && dispatch) {
              tr.setSelection(Selection.near(doc.resolve(start)));
              dispatch(tr);
              return true;
            }

            while (pos-- > 0) {
              const $resolved = doc.resolve(pos);

              if (
                !$anchor.parent.eq($resolved.parent) &&
                $resolved.parent.type.name === 'callout' &&
                $resolved.depth == 3 &&
                dispatch
              ) {
                const { lStart, lLen } = lastLine(state, view, $resolved);
                const start =
                  lStart +
                  Math.min(lLen, lastLineOffset(view, prevSelection) - 1);

                tr.setSelection(Selection.near(doc.resolve(start)));
                dispatch(tr);
                return true;
              }
            }
            break;

          case DOWN:
            if (pos < Selection.atEnd($anchor.parent).anchor) {
              return false;
            }

            while (pos++ < doc.content.size) {
              const $resolved = doc.resolve(pos);

              if (
                !$anchor.parent.eq($resolved.parent) &&
                $resolved.parent.type.name === 'callout' &&
                $resolved.depth == 3 &&
                dispatch
              ) {
                const start =
                  pos +
                  Math.min(
                    lastLineOffset(view, prevSelection),
                    doc.resolve(pos).parent.textContent.length,
                  );
                tr.setSelection(Selection.near(doc.resolve(start)));
                dispatch(tr);
                return true;
              }
            }
            break;

          case RIGHT:
            if ($anchor.depth < 3) {
              while (pos++ < doc.content.size) {
                const $resolved = doc.resolve(pos);
                if (
                  $resolved.parent.type.name === 'callout' &&
                  $resolved.depth === 3 &&
                  dispatch
                ) {
                  tr.setSelection(Selection.near($resolved));
                  dispatch(tr);
                  return true;
                }
              }
            }
            break;

          case LEFT:
            if ($anchor.depth < 3) {
              while (pos-- > 0) {
                const $resolved = doc.resolve(pos);
                if (
                  $resolved.parent.type.name === 'callout' &&
                  $resolved.depth === 3 &&
                  dispatch
                ) {
                  tr.setSelection(Selection.near($resolved));
                  dispatch(tr);
                  return true;
                }
              }
            }

            if (pos > start) {
              return false;
            }

            if (!editor.getTextCursorPosition().prevBlock && dispatch) {
              tr.setSelection(Selection.near(doc.resolve(start)));
              dispatch(tr);
              return true;
            }

            break;
        }
        return false;
      });
    };

    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [prevSelection, editor]);
};
