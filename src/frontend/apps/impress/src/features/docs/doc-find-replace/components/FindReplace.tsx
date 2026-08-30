import { Button } from '@gouvfr-lasuite/ui-components';
import { announce } from '@react-aria/live-announcer';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import { Box, ButtonCloseModal, Card, Text } from '@/components';
import { useEditorStore } from '@/docs/doc-editor/stores/useEditorStore';
import ArrowDownIcon from '@/icons/arrow-down.svg';
import ArrowSquarepathIcon from '@/icons/arrow-squarepath.svg';
import ArrowUpIcon from '@/icons/arrow-up.svg';
import { useFocusStore } from '@/stores/useFocusStore';

import { useFindReplace } from '../hooks/useFindReplace';
import { useFindReplaceStore } from '../stores/useFindReplaceStore';

const Input = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.875rem;
  color: inherit;
  font-family: inherit;
  padding: 0 var(--c--globals--spacings--2xs);
`;

export const FindReplace = () => {
  const { t } = useTranslation();
  const { editor } = useEditorStore();
  const { close, openCount } = useFindReplaceStore();
  const { restoreFocus } = useFocusStore();

  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    setQuery,
    replacement,
    setReplacement,
    matchCount,
    activeIndex,
    goToNext,
    goToPrevious,
    replaceCurrent,
    replaceAll,
  } = useFindReplace(editor);

  /**
   * Pre-fill the find input with the currently selected
   * text in the editor, if any.
   * Gives the focus to the find input and selects its content so that
   * the user can start typing a new query immediately.
   */
  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor;
    if (tiptapEditor) {
      const { from, to } = tiptapEditor.state.selection;
      const selectedText =
        from !== to ? tiptapEditor.state.doc.textBetween(from, to, ' ') : '';

      if (selectedText) {
        setQuery(selectedText);
      }
    }

    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [editor?._tiptapEditor, setQuery, openCount]);

  const handleClose = () => {
    close();
    restoreFocus();
  };

  const handlePanelKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  };

  const handleFindKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      goToPrevious();
    } else {
      goToNext();
    }
  };

  const hasMatches = matchCount > 0;
  const counterLabel = hasMatches
    ? `${activeIndex + 1} / ${matchCount}`
    : '0 / 0';

  const statusLabel = !query
    ? ''
    : hasMatches
      ? t('{{current}} of {{total}}', {
          current: activeIndex + 1,
          total: matchCount,
          description:
            'Message to announce the current match index and total number of matches in the find and replace panel',
        })
      : t('No matches', {
          description:
            'Message to announce that there are no matches in the find and replace panel',
        });

  const handleReplaceCurrent = () => {
    if (!hasMatches) {
      return;
    }
    replaceCurrent();
    announce(
      t('Replaced', {
        description:
          'Message to announce that the current match has been replaced in the find and replace panel',
      }),
      'polite',
    );
  };

  const handleReplaceAll = () => {
    if (!hasMatches) {
      return;
    }
    const count = matchCount;
    replaceAll();
    announce(
      t('{{count}} match replaced', {
        count,
        description:
          'Message to announce the number of matches replaced in the find and replace panel',
      }),
      'polite',
    );
  };

  const handleReplaceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    handleReplaceCurrent();
  };

  return (
    <Card
      role="search"
      aria-label={t('Find and replace')}
      onKeyDown={handlePanelKeyDown}
      $radius="var(--c--globals--spacings--xs)"
      $width="331px"
      $css={css`
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
      `}
      $padding="none"
    >
      <Box
        $direction="row"
        $align="center"
        $height="40px"
        $gap="3xs"
        $padding={{ vertical: '3xs', horizontal: 'xs' }}
      >
        <Input
          ref={findInputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleFindKeyDown}
          placeholder={t('Find, replace...')}
          aria-label={t('Find in document')}
          aria-describedby="find-replace-status"
        />
        <Text
          id="find-replace-status"
          role="status"
          aria-atomic="true"
          className="sr-only"
        >
          {statusLabel}
        </Text>
        {query && (
          <>
            <Text
              aria-hidden="true"
              $size="xs"
              $color="var(--c--contextuals--content--semantic--neutral--tertiary)"
              $css={css`
                white-space: nowrap;
                font-variant-numeric: tabular-nums;
              `}
            >
              {counterLabel}
            </Text>
            <Button
              aria-label={t('Previous match')}
              onClick={goToPrevious}
              disabled={!hasMatches}
              icon={<ArrowUpIcon aria-hidden="true" width="16" height="16" />}
              color="neutral"
              variant="tertiary"
              size="nano"
            />
            <Button
              aria-label={t('Next match')}
              onClick={goToNext}
              disabled={!hasMatches}
              icon={<ArrowDownIcon aria-hidden="true" width="16" height="16" />}
              color="neutral"
              variant="tertiary"
              size="nano"
            />
            <Box
              $background="var(--c--contextuals--border--surface--primary)"
              $width="1px"
              $height="16px"
              $margin={{ horizontal: '4xs' }}
            />
          </>
        )}
        <Button
          aria-label={t('Toggle replace')}
          aria-expanded={isReplaceOpen}
          color={isReplaceOpen ? 'brand' : 'neutral'}
          variant={isReplaceOpen ? 'secondary' : 'tertiary'}
          size="nano"
          onClick={() => setIsReplaceOpen((prev) => !prev)}
          icon={
            <ArrowSquarepathIcon aria-hidden="true" width="16" height="16" />
          }
        />
        <ButtonCloseModal
          aria-label={t('Close find and replace')}
          onClick={handleClose}
          size="nano"
          iconProps={{ width: '16', height: '16' }}
        />
      </Box>

      {isReplaceOpen && (
        <Box
          $direction="row"
          $align="center"
          $height="40px"
          $padding={{ vertical: '3xs', horizontal: 'xs' }}
          $gap="3xs"
          $background="var(--c--contextuals--background--surface--tertiary)"
          $css={css`
            border-top: 1px solid
              var(--c--contextuals--border--surface--primary);
          `}
          $radius="0 0 var(--c--globals--spacings--xs) var(--c--globals--spacings--xs)"
        >
          <Input
            type="text"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder={t('Replace by...')}
            aria-label={t('Replace with')}
          />
          <Button
            aria-label={t('Replace all')}
            onClick={handleReplaceAll}
            color="neutral"
            variant="tertiary"
            size="nano"
            disabled={!hasMatches}
          >
            {t('Replace all')}
          </Button>
          <Button
            aria-label={t('Replace')}
            onClick={handleReplaceCurrent}
            color="brand"
            variant="primary"
            size="nano"
            disabled={!hasMatches}
          >
            {t('Replace')}
          </Button>
        </Box>
      )}
    </Card>
  );
};
