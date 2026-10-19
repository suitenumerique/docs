import {
  Button,
  ButtonElement,
  DropdownMenu,
  Tooltip,
} from '@gouvfr-lasuite/ui-components';
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
  const { setThreadsSidebarTarget, filter, setFilter, resetFilter } =
    useCommentSidebarStore();
  const portalRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  /** Reset the filter when the comment sidebar is closed */
  useEffect(() => {
    return () => {
      resetFilter();
    };
  }, [resetFilter]);

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
              {t('Comments', {
                description: 'Title of the comments side panel',
              })}
            </Text>

            <DropdownMenu
              options={[
                {
                  label: t('Open', {
                    description:
                      'Dropdown menu item to filter the comments sidebar to only show open (unresolved) comment threads. This is a state/adjective ("open comments"), not the verb "to open".',
                  }),
                  callback: () => setFilter('open'),
                  isChecked: filter === 'open',
                },
                {
                  label: t('Resolved', {
                    description:
                      'Dropdown menu item to filter the comments sidebar to only show resolved comment threads.',
                  }),
                  callback: () => setFilter('resolved'),
                  isChecked: filter === 'resolved',
                },
              ]}
              isOpen={open}
              shouldCloseOnInteractOutside={() => true}
              onOpenChange={setOpen}
            >
              <Tooltip
                content={t('Filter comments', {
                  description:
                    'Tooltip and accessible name of the button filtering comments by status',
                })}
                placement="bottom"
              >
                <Button
                  aria-label={t('Filter comments', {
                    description:
                      'Tooltip and accessible name of the button filtering comments by status',
                  })}
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
            aria-label={t('Close the comments sidebar', {
              description:
                'Accessible name of the button closing the comments panel',
            })}
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
    ? t('Hide the comments sidebar', {
        description: 'Accessible name of the toggle hiding the comments panel',
      })
    : t('Show the comments sidebar', {
        description: 'Accessible name of the toggle showing the comments panel',
      });

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
