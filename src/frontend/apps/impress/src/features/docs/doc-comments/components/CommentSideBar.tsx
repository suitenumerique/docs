import {
  Button,
  ButtonElement,
  Tooltip,
} from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu } from '@gouvfr-lasuite/ui-kit';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import CommentsIcon from '@/assets/icons/ui-kit/bubble-text.svg';
import SortingResolvedSVG from '@/assets/icons/ui-kit/filter-notification.svg';
import SortingOpenSVG from '@/assets/icons/ui-kit/filter_list.svg';
import { Box, ButtonCloseModal, Text } from '@/components/';
import { useRightPanelStore } from '@/features/right-panel/stores/useRightPanelStore';
import { useFocusStore } from '@/stores';

import { useCommentSidebarStore } from '../stores/useCommentSidebarStore';

interface CommentSideBarProps {
  onClose: () => void;
}

export const CommentSideBar = ({ onClose }: CommentSideBarProps) => {
  const { t } = useTranslation();
  const { setThreadsSidebarTarget, filter, setFilter } =
    useCommentSidebarStore();
  const portalRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (portalRef.current) {
      setThreadsSidebarTarget(portalRef.current);
    }
    return () => {
      setThreadsSidebarTarget(null);
    };
  }, [setThreadsSidebarTarget]);

  return (
    <Box $height="inherit">
      <Box
        $padding={{ vertical: 'base', horizontal: 'sm' }}
        $css={css`
          border-bottom: 1px solid
            var(--c--contextuals--border--surface--primary);
        `}
      >
        <Box $direction="row" $align="center" $justify="space-between">
          <Box $direction="row" $align="center" $gap="2xs">
            <Text as="h2" $weight="bold" $size="16px" $margin="0">
              {t('Comments')}
            </Text>

            <DropdownMenu
              options={[
                {
                  label: t('Open'),
                  callback: () => setFilter('open'),
                  isChecked: filter === 'open',
                },
                {
                  label: t('Resolved'),
                  callback: () => setFilter('resolved'),
                  isChecked: filter === 'resolved',
                },
              ]}
              isOpen={open}
              shouldCloseOnInteractOutside={() => true}
              onOpenChange={setOpen}
            >
              <Tooltip content={t('Filter comments')} placement="bottom">
                <Button
                  aria-label={t('Filter comments')}
                  size="nano"
                  icon={
                    filter === 'open' ? (
                      <SortingOpenSVG
                        width={18}
                        height={18}
                        aria-hidden="true"
                      />
                    ) : (
                      <SortingResolvedSVG
                        width={18}
                        height={18}
                        aria-hidden="true"
                      />
                    )
                  }
                  color={filter === 'open' ? 'neutral' : 'brand'}
                  variant={filter === 'open' ? 'tertiary' : 'secondary'}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setOpen((o) => !o);
                  }}
                />
              </Tooltip>
            </DropdownMenu>
          </Box>
          <ButtonCloseModal
            aria-label={t('Close the comments sidebar')}
            onClick={onClose}
          />
        </Box>
      </Box>
      <div
        ref={portalRef}
        className="--docs--comments-sidebar bn-root bn-mantine"
        data-mantine-color-scheme="light"
      />
    </Box>
  );
};

export const CommentSideBarButton = () => {
  const { t } = useTranslation();
  const { isPanelOpen, activePanel, setActivePanel, setIsPanelOpen } =
    useRightPanelStore();
  const buttonRef = useRef<ButtonElement>(null);
  const { addLastFocus } = useFocusStore();

  const isActive = isPanelOpen && activePanel === 'comments';
  const ariaLabel = isActive
    ? t('Hide the comments sidebar')
    : t('Show the comments sidebar');

  return (
    <Button
      ref={buttonRef}
      size="small"
      onClick={() => {
        if (isActive) {
          setIsPanelOpen(false);
        } else {
          setActivePanel('comments');
          addLastFocus(buttonRef.current);
        }
      }}
      aria-label={ariaLabel}
      aria-expanded={isActive}
      color="neutral"
      variant={isActive ? 'secondary' : 'tertiary'}
      icon={<CommentsIcon width={24} height={24} aria-hidden="true" />}
    ></Button>
  );
};
