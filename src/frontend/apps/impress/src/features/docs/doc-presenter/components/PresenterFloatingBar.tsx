import { Button } from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-kit';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Link,
  Maximize,
  Minimize,
  Share,
  XMark,
} from '@gouvfr-lasuite/ui-kit/icons';
import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, Text } from '@/components';

interface PresenterFloatingBarProps {
  index: number;
  total: number;
  isFullscreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCopyLink: () => void;
  onExportPdf: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
  isExportingPdf: boolean;
}

const barCss = css`
  height: 32px;
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  flex-direction: row !important;
  align-items: center;
  gap: 0.25rem;
  padding: var(--c--globals--spacings--3xs, 4px);
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--c--contextuals--content--semantic--neutral--secondary);
  border: 1px solid var(--c--contextuals--border--surface--primary);
  background: var(--c--contextuals--background--surface--primary);
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);

  button {
    width: 24px;
    min-width: 24px;
    height: 24px;
    min-height: 24px;
    padding: 0;
    border-radius: 4px;
  }

  button svg {
    width: 16px;
    height: 16px;
  }
`;

const separatorCss = css`
  width: 1px;
  height: 1.25rem;
  background: var(--c--theme--colors--greyscale-200, #e5e5e5);
`;

// The ui-kit DropdownMenu renders its popover in a React Aria portal at the
// document root, outside the presenter overlay's stacking context — so its
// z-index (and width) can only be raised above the overlay via a global style.
// Mounted only while the menu is open (see render below).
const presenterDropdownLayerZIndex = 1002;

const PresenterDropdownLayerStyle = createGlobalStyle`
  .react-aria-Popover {
    z-index: ${presenterDropdownLayerZIndex};
  }

  .react-aria-Popover .c__dropdown-menu--tiny {
    width: 150px;
    min-width: 150px;
  }

  .react-aria-Popover .c__dropdown-menu--tiny .c__dropdown-menu-item {
    box-sizing: border-box;
    height: 32px;
  }
`;

export const PresenterFloatingBar = ({
  index,
  total,
  isFullscreen,
  onPrev,
  onNext,
  onCopyLink,
  onExportPdf,
  onToggleFullscreen,
  onClose,
  isExportingPdf,
}: PresenterFloatingBarProps) => {
  const { t } = useTranslation();
  const isFirst = index <= 0;
  const isLast = index >= total - 1;
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  // Move focus into the dialog on open so keyboard users land on the
  // controls (an ARIA dialog must move focus inside itself; here on the
  // first enabled toolbar button — "Next", since "Previous" is disabled on
  // the first slide). The rAF wins the race against the dropdown's async
  // focus restoration — same pattern as ModalRemoveDoc.
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      barRef.current
        ?.querySelector<HTMLButtonElement>('button:not([disabled])')
        ?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // The DropdownMenu is controlled (isOpen/onOpenChange); stop the click from
  // also reaching the overlay so the menu toggles cleanly.
  const toggleActions = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setIsActionsOpen((isOpen) => !isOpen);
  };

  const actionOptions = useMemo<DropdownMenuItem[]>(
    () => [
      {
        label: t('Copy link to slide'),
        icon: <Link aria-hidden="true" width="16" height="16" />,
        callback: onCopyLink,
      },
      {
        label: t('Download PDF'),
        icon: <Download aria-hidden="true" width="16" height="16" />,
        callback: onExportPdf,
        isDisabled: isExportingPdf,
      },
    ],
    [isExportingPdf, onCopyLink, onExportPdf, t],
  );

  return (
    <>
      {isActionsOpen && <PresenterDropdownLayerStyle />}
      <Box
        ref={barRef}
        $direction="row"
        $align="center"
        $css={barCss}
        role="toolbar"
        aria-label={t('Presenter controls')}
      >
        <Button
          size="nano"
          color="neutral"
          variant="tertiary"
          disabled={isFirst}
          onClick={onPrev}
          aria-label={t('Previous slide')}
          icon={<ChevronLeft />}
        />
        <Text as="span" $size="sm" $color="neutral" aria-hidden="true">
          {index + 1} / {total}
        </Text>
        <Button
          size="nano"
          color="neutral"
          variant="tertiary"
          disabled={isLast}
          onClick={onNext}
          aria-label={t('Next slide')}
          icon={<ChevronRight />}
        />
        <Box $css={separatorCss} aria-hidden />
        <DropdownMenu
          options={actionOptions}
          isOpen={isActionsOpen}
          onOpenChange={setIsActionsOpen}
          shouldCloseOnInteractOutside={() => true}
          variant="tiny"
        >
          <Button
            size="nano"
            color="neutral"
            variant="tertiary"
            onClick={toggleActions}
            aria-label={t('More options')}
            aria-expanded={isActionsOpen}
            aria-haspopup="menu"
            icon={<Share />}
          />
        </DropdownMenu>
        <Button
          size="nano"
          color="neutral"
          variant="tertiary"
          onClick={onToggleFullscreen}
          aria-label={
            isFullscreen ? t('Exit fullscreen') : t('Enter fullscreen')
          }
          icon={isFullscreen ? <Minimize /> : <Maximize />}
        />
        <Button
          size="nano"
          color="neutral"
          variant="tertiary"
          onClick={onClose}
          aria-label={t('Close presenter')}
          icon={<XMark />}
        />
      </Box>
    </>
  );
};
