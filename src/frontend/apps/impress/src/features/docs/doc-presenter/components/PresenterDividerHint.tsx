import { Button } from '@gouvfr-lasuite/cunningham-react';
import {
  Divider as DividerIcon,
  Info,
  XMark,
} from '@gouvfr-lasuite/ui-kit/icons';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';

interface PresenterDividerHintProps {
  onDismiss: () => void;
}

// Shared by every text node in the hint (the line-height/flex/etc. differ and
// stay per-element).
const marianneFontCss = css`
  font-family: Marianne, var(--c--globals--font--families--base);
`;

const hintCss = css`
  position: relative;
  flex-direction: column !important;
  align-items: flex-start;
  width: 309px;
  height: 196px;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--c--contextuals--border--surface--primary, #dfe2ea);
  border-radius: 8px;
  background: var(--c--contextuals--background--surface--primary, #fff);
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
`;

const hintHeaderCss = css`
  position: relative;
  flex-direction: row !important;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 60px;
  box-sizing: border-box;
  flex-shrink: 0;
  overflow: hidden;
  padding: 12px 32px 12px 12px;
  border-bottom: 1px solid
    var(--c--contextuals--border--surface--primary, #dfe2ea);
  background: var(--c--contextuals--background--surface--tertiary, #f6f8f9);
  color: var(--c--contextuals--content--semantic--neutral--tertiary, #626a80);

  & > svg {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }
`;

const closeButtonCss = css`
  position: absolute;
  top: 4px;
  right: 4px;

  .c__button {
    width: 24px;
    min-width: 24px;
    height: 24px;
    min-height: 24px;
    padding: 4px;
    border-radius: 4px;
  }

  .c__button svg {
    width: 16px;
    height: 16px;
  }
`;

const hintBodyCss = css`
  position: relative;
  width: 100%;
  height: 136px;
  flex-shrink: 0;
  overflow: hidden;
`;

const commandCss = css`
  position: absolute;
  top: 24px;
  left: 60px;
  flex-direction: row !important;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 24px;
  padding-right: 2px;
  border-radius: 2px;
  color: var(--c--contextuals--content--semantic--neutral--primary, #222631);
  font-family: Inter, var(--c--globals--font--families--base);

  &::before {
    position: absolute;
    inset: -2px -2px -2px -3px;
    border-radius: 4px;
    background: var(
      --c--contextuals--background--semantic--overlay--primary,
      rgba(24, 27, 36, 0.05)
    );
    content: '';
  }
`;

const filteredMenuCss = css`
  position: absolute;
  top: 53px;
  left: 55px;
  width: 200px;
  overflow: hidden;
  border: 1px solid var(--c--contextuals--border--surface--primary, #dfe2ea);
  border-radius: 8px;
  background: var(--c--contextuals--background--surface--primary, #fff);
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
`;

const filteredTitleSectionCss = css`
  flex-direction: row !important;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 8px 2px;
`;

const filteredItemCss = css`
  flex-direction: row !important;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  padding: 8px;
  background: var(
    --c--contextuals--background--semantic--overlay--primary,
    rgba(24, 27, 36, 0.05)
  );

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;

export const PresenterDividerHint = ({
  onDismiss,
}: PresenterDividerHintProps) => {
  const { t } = useTranslation();
  return (
    <Box $css={hintCss}>
      <Box $css={hintHeaderCss}>
        <Info
          aria-hidden="true"
          color="var(--c--contextuals--content--semantic--neutral--tertiary)"
        />
        <Text
          as="p"
          $color="var(--c--contextuals--content--semantic--neutral--tertiary)"
          $size="14px"
          $weight="500"
          $margin={{ all: '0' }}
          $css={css`
            flex: 1;
            min-width: 0;
            ${marianneFontCss}
            line-height: 18px;
            word-break: break-word;
          `}
        >
          {t('You can use the divider to tell Docs where to split your slides')}
        </Text>
        <Box $css={closeButtonCss}>
          <Button
            size="nano"
            color="neutral"
            variant="tertiary"
            aria-label={t('Close')}
            icon={<XMark aria-hidden="true" />}
            onClick={onDismiss}
          />
        </Box>
      </Box>
      <Box $css={hintBodyCss}>
        <Box $css={commandCss} aria-hidden="true">
          <Text
            as="span"
            $size="16px"
            $css={css`
              position: relative;
              line-height: 24px;
            `}
          >
            /
          </Text>
          <Text
            as="span"
            $size="16px"
            $css={css`
              position: relative;
              line-height: 24px;
            `}
          >
            Divider|
          </Text>
        </Box>
        <Box $css={filteredMenuCss} aria-hidden="true">
          <Box $css={filteredTitleSectionCss}>
            <Text
              as="span"
              $size="12px"
              $weight="700"
              $color="var(--c--contextuals--content--semantic--neutral--tertiary, #626a80)"
              $css={css`
                flex: 1;
                min-width: 0;
                ${marianneFontCss}
                line-height: 16px;
                word-break: break-word;
              `}
            >
              {t('Filtered results')}
            </Text>
          </Box>
          <Box $css={filteredItemCss}>
            <DividerIcon aria-hidden="true" />
            <Text
              as="span"
              $size="12px"
              $weight="500"
              $css={css`
                flex: 1;
                min-width: 0;
                overflow: hidden;
                ${marianneFontCss}
                line-height: 16px;
                text-overflow: ellipsis;
                white-space: nowrap;
              `}
            >
              {t('Divider')}
            </Text>
            <Text
              as="span"
              $size="12px"
              $color="var(--c--contextuals--content--semantic--neutral--tertiary, #626a80)"
              $css={css`
                overflow: hidden;
                ${marianneFontCss}
                line-height: 16px;
                text-align: right;
                text-overflow: ellipsis;
                white-space: nowrap;
              `}
            >
              ---
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
