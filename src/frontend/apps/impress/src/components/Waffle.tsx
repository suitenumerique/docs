import { LaGaufreV2 } from '@gouvfr-lasuite/ui-kit';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useConfig } from '@/core';

const SHADOW_HOST_ID = 'lasuite-widget-lagaufre-shadow';
const BUTTON_CLASS = 'lagaufre-button';

/**
 * TODO: This is a temporary workaround to fix the placement of the waffle panel.
 * @see https://github.com/suitenumerique/ui-kit/pull/260
 */
const useWafflePanelPlacement = () => {
  useEffect(() => {
    const observers: MutationObserver[] = [];

    const applyPosition = (shadowRoot: ShadowRoot) => {
      const dialog = shadowRoot.querySelector<HTMLElement>('.wrapper-dialog');
      if (!dialog) {
        return;
      }

      const button = document.querySelector<HTMLElement>(`.${BUTTON_CLASS}`);
      if (!button) {
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      const bottom = `${window.innerHeight - buttonRect.top + 10}px`;
      const left = `${buttonRect.left}px`;

      if (
        dialog.style.getPropertyValue('bottom') === bottom &&
        dialog.style.getPropertyValue('left') === left
      ) {
        return;
      }

      dialog.style.setProperty('position', 'fixed', 'important');
      dialog.style.setProperty('top', 'auto', 'important');
      dialog.style.setProperty('bottom', bottom, 'important');
      dialog.style.setProperty('right', 'auto', 'important');
      dialog.style.setProperty('left', left, 'important');
    };

    const setupPanel = (host: HTMLElement) => {
      const { shadowRoot } = host;
      if (!shadowRoot) {
        return;
      }

      const innerObserver = new MutationObserver(() =>
        applyPosition(shadowRoot),
      );
      innerObserver.observe(shadowRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style'],
      });
      observers.push(innerObserver);
    };

    const existing = document.getElementById(SHADOW_HOST_ID);
    if (existing) {
      setupPanel(existing);
    }

    const outerObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && node.id === SHADOW_HOST_ID) {
            setupPanel(node);
          }
        }
      }
    });

    outerObserver.observe(document.body, { childList: true });
    observers.push(outerObserver);

    return () => observers.forEach((o) => o.disconnect());
  }, []);
};

export const Waffle = () => {
  const { t } = useTranslation();
  const { data: conf } = useConfig();

  const waffleConfig = conf?.theme_customization?.waffle;

  useWafflePanelPlacement();

  if (!waffleConfig?.apiUrl && !waffleConfig?.data) {
    return null;
  }

  return (
    <Box
      $css={css`
        & > div {
          display: flex;

          .c__button--brand--tertiary svg path {
            fill: var(--c--contextuals--content--semantic--neutral--tertiary);
          }
        }
      `}
    >
      <LaGaufreV2
        {...waffleConfig}
        label={waffleConfig.label ?? t('Digital LaSuite services')}
        newWindowLabelSuffix={` (${t('new window')})`}
      />
    </Box>
  );
};
