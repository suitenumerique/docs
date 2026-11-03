import { announce } from '@react-aria/live-announcer';
import { EmojiPicker as Frimousse } from 'frimousse';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import { Box } from '@/components';

import { HighlightedEmojis, createResolveEmojiData } from './emojiData';

export const PICKER_HEIGHT = 352;

const COLUMNS = 9;

const Picker = styled(Frimousse.Root)`
  display: flex;
  flex-direction: column;
  width: fit-content;
  height: min(${PICKER_HEIGHT}px, 100dvh - 20px);
  overflow: hidden;
  isolation: isolate;
  font-family: var(--c--globals--font--families--base);
  color: var(--c--contextuals--content--semantic--neutral--primary);
  background: var(--c--contextuals--background--surface--primary);
  border: 1px solid var(--c--contextuals--border--surface--primary);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);

  [frimousse-search] {
    position: relative;
    z-index: 10;
    margin: 8px 8px 0;
    padding: 8px 10px;
    font-size: 14px;
    color: inherit;
    background: var(
      --c--contextuals--background--semantic--contextual--primary
    );
    border: none;
    border-radius: 6px;
    appearance: none;
  }

  [frimousse-search]:focus-visible,
  [frimousse-emoji]:focus-visible,
  [frimousse-skin-tone-selector]:focus-visible {
    outline: 2px solid var(--c--contextuals--content--semantic--brand--tertiary);
    outline-offset: -2px;
  }

  [frimousse-viewport] {
    flex: 1;
    outline: none;
  }

  [frimousse-list] {
    padding-bottom: 12px;
    user-select: none;
  }

  [frimousse-category-header] {
    box-sizing: border-box;
    padding: 12px 12px 6px;
    font-size: 12px;
    font-weight: 500;
    background: var(--c--contextuals--background--surface--primary);
  }

  [frimousse-row] {
    padding-inline: 6px;
    scroll-margin-block: 6px;
  }

  [frimousse-emoji] {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    font-size: 18px;
    cursor: pointer;
    border-radius: 6px;
  }

  [frimousse-emoji]:hover,
  [frimousse-emoji][data-active] {
    background: var(
      --c--contextuals--background--semantic--contextual--primary
    );
  }

  [frimousse-skin-tone-selector] {
    all: unset;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 16px;
    cursor: pointer;
    border-radius: 6px;
  }

  [frimousse-skin-tone-selector]:hover {
    background: var(
      --c--contextuals--background--semantic--contextual--primary
    );
  }
`;

const Message = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  padding: 6px 12px;
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
`;

const ActiveEmoji = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;

  > :first-child {
    flex-shrink: 0;
    font-size: 18px;
    line-height: 1;
  }

  > :last-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

/** Frimousse only mounts `Empty` when nothing matches: announce it then. */
const EmptyResults = () => {
  const { t } = useTranslation();
  const message = t('No results found...', {
    description: 'Shown and announced when no emoji matches the picker search',
  });

  useEffect(() => {
    announce(message, 'polite');
  }, [message]);

  return <Message>{message}</Message>;
};

// Safari sends the Enter confirming a composition with keyCode 229 only.
const isComposing = (event: KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;

interface EmojiPickerProps {
  onClickOutside: () => void;
  onEmojiSelect: (emoji: string) => void;
  /** Emojis listed first, in a category of their own. */
  highlightedEmojis?: HighlightedEmojis;
  withOverlay?: boolean;
}

export const EmojiPicker = ({
  onClickOutside,
  onEmojiSelect,
  highlightedEmojis,
  withOverlay = false,
}: EmojiPickerProps) => {
  const { t, i18n } = useTranslation();
  const resolveEmojiData = useMemo(
    () => createResolveEmojiData(highlightedEmojis),
    [highlightedEmojis],
  );
  const searchLabel = t('Search', {
    description: 'Placeholder of a search input',
  });

  const pickerRef = useRef<HTMLDivElement>(null);

  /**
   * Frimousse reads the arrows and Enter on `document`, but a React ancestor
   * of the portal can stop the keys on the way there (the doc tree does).
   * So the picker keeps them and hands them over to `document` itself.
   */
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) {
      return;
    }

    const forwardKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      // The keys of an IME composition belong to the IME, not to Frimousse.
      if (isComposing(event)) {
        return;
      }
      const forwarded = new KeyboardEvent('keydown', event);
      document.dispatchEvent(forwarded);
      if (forwarded.defaultPrevented) {
        event.preventDefault();
      }
    };

    picker.addEventListener('keydown', forwardKeyDown);
    return () => picker.removeEventListener('keydown', forwardKeyDown);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !isComposing(event.nativeEvent)) {
      event.stopPropagation();
      onClickOutside();
    }
  };

  const pickerContent = (
    <Box
      $position="absolute"
      $zIndex={1000}
      // Under the trigger, that is the positioned parent
      $css={css`
        top: 100%;
        margin-top: var(--c--globals--spacings--3xs);
      `}
    >
      <Picker
        ref={pickerRef}
        locale={i18n.resolvedLanguage}
        columns={COLUMNS}
        resolveEmojiData={resolveEmojiData}
        onEmojiSelect={({ emoji }) => onEmojiSelect(emoji)}
        onKeyDownCapture={handleKeyDown}
      >
        <Frimousse.Search
          autoFocus
          placeholder={searchLabel}
          aria-label={searchLabel}
        />
        <Frimousse.Viewport>
          <Frimousse.Loading>
            <Message>
              {t('Loading...', {
                description: 'Shown while the emojis of the picker load',
              })}
            </Message>
          </Frimousse.Loading>
          <Frimousse.Empty>
            <EmptyResults />
          </Frimousse.Empty>
          <Frimousse.List />
        </Frimousse.Viewport>
        <Footer>
          <Frimousse.ActiveEmoji>
            {({ emoji }) => (
              <ActiveEmoji>
                <span>{emoji?.emoji}</span>
                <span>{emoji ? emoji.label : searchLabel}</span>
              </ActiveEmoji>
            )}
          </Frimousse.ActiveEmoji>
          <Frimousse.SkinToneSelector
            aria-label={t('Change skin tone', {
              description: 'Button cycling the emoji skin tone in the picker',
            })}
          />
        </Footer>
      </Picker>
    </Box>
  );

  if (withOverlay) {
    return (
      <>
        {/* Transparent overlay to close the picker on an outside click */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999,
            backgroundColor: 'transparent',
          }}
          onClick={onClickOutside}
        />
        {pickerContent}
      </>
    );
  }

  return pickerContent;
};
