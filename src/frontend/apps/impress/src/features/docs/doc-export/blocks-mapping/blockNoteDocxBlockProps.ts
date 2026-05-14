import {
  COLORS_DEFAULT,
  DefaultProps,
  UnreachableCaseError,
} from '@blocknote/core';
import { IParagraphOptions, ShadingType } from 'docx';

/**
 * Same semantics as `@blocknote/xl-docx-exporter` `blockPropsToStyles`, but
 * `textAlignment: justify` maps to OOXML `both` (normal justified paragraphs).
 * Upstream maps justify to `distribute`, which uses “distribute all characters equally”
 * and does not match browser/Word paragraph justification.
 */
export function blockNoteDocxBlockPropsToStyles(
  props: Partial<DefaultProps>,
  colors: typeof COLORS_DEFAULT,
): IParagraphOptions {
  return {
    shading:
      props.backgroundColor === 'default' || !props.backgroundColor
        ? undefined
        : {
            type: ShadingType.CLEAR,
            fill: (() => {
              const color = colors[props.backgroundColor]?.background;
              if (!color) {
                return undefined;
              }
              return color.slice(1);
            })(),
          },
    run:
      props.textColor === 'default' || !props.textColor
        ? undefined
        : {
            color: (() => {
              const color = colors[props.textColor]?.text;
              if (!color) {
                return undefined;
              }
              return color.slice(1);
            })(),
          },
    alignment:
      !props.textAlignment || props.textAlignment === 'left'
        ? undefined
        : props.textAlignment === 'center'
          ? 'center'
          : props.textAlignment === 'right'
            ? 'right'
            : props.textAlignment === 'justify'
              ? 'both'
              : (() => {
                  throw new UnreachableCaseError(props.textAlignment);
                })(),
  };
}
