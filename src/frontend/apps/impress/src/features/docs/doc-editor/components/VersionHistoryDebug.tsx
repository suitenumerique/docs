import { type VersionOperationResult } from '@blocknote/core/extensions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';

export interface HistoryDebugSettings {
  groupMaxGap: number;
  groupMaxDuration: number;
  limit: number;
}

export const HISTORY_DEBUG_PRESETS = {
  fine: { groupMaxGap: 10_000, groupMaxDuration: 60_000 },
  sessions: { groupMaxGap: 300_000, groupMaxDuration: 1_800_000 },
};

interface Props {
  defaults: HistoryDebugSettings;
  initialSettings: HistoryDebugSettings;
  canCreate: boolean;
  onDismiss: () => void;
  onApply: (settings: HistoryDebugSettings) => Promise<VersionOperationResult>;
  onCreate: () => Promise<VersionOperationResult>;
}

/** Session-local request overrides; never changes yhub's stored history. */
export const VersionHistoryDebug = ({
  defaults,
  initialSettings,
  canCreate,
  onDismiss,
  onApply,
  onCreate,
}: Props) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(initialSettings);
  const [unit, setUnit] = useState(60_000);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const valid =
    Number.isSafeInteger(settings.groupMaxGap) &&
    settings.groupMaxGap > 0 &&
    Number.isSafeInteger(settings.groupMaxDuration) &&
    settings.groupMaxDuration > 0 &&
    Number.isSafeInteger(settings.limit) &&
    settings.limit > 0 &&
    settings.limit <= 1000;

  const run = async (
    action: () => Promise<VersionOperationResult>,
    success: string,
  ) => {
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      setMessage(
        result.status === 'done'
          ? success
          : result.status === 'error' && result.error.type === 'conflict'
            ? t(
                'Make an edit and wait for it to sync before creating a version.',
              )
            : t('The action could not be completed. Please try again.'),
      );
    } catch {
      setMessage(t('The action could not be completed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      as="details"
      $css={`
        padding: 16px;
        border-bottom: 1px solid var(--c--contextuals--border--surface--primary);
        flex-shrink: 0;
        font-size: 13px;
        line-height: 1.5;
        summary {
          cursor: pointer;
          font-weight: 600;
          line-height: 28px;
          list-style: none;
        }
        summary::-webkit-details-marker { display: none; }
        summary::before {
          content: '›';
          display: inline-block;
          margin-right: 8px;
          font-size: 18px;
          transition: transform 150ms ease;
        }
        &[open] summary::before { transform: rotate(90deg); }
        fieldset { border: 0; padding: 0; margin: 16px 0 0; min-width: 0; }
        .debug-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .debug-field { display: flex; flex-direction: column; gap: 6px; }
        .debug-group { grid-column: 1 / -1; }
        .debug-field:not(.debug-group) {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 1fr 88px;
          align-items: center;
        }
        label { font-weight: 500; }
        .debug-duration { display: grid; grid-template-columns: 1fr 112px; gap: 8px; }
        button, input, select { font: inherit; box-sizing: border-box; }
        input, select {
          width: 100%;
          min-width: 0;
          height: 36px;
          padding: 6px 10px;
          border: 1px solid var(--c--contextuals--border--surface--primary);
          border-radius: 6px;
          background: var(--c--contextuals--background--surface--primary);
          color: inherit;
        }
        button {
          cursor: pointer;
          padding: 7px 12px;
          border: 1px solid var(--c--contextuals--border--surface--primary);
          border-radius: 6px;
          background: var(--c--contextuals--background--surface--primary);
          color: inherit;
          font-weight: 500;
          transition: background 150ms ease, border-color 150ms ease;
        }
        button:hover:not(:disabled) {
          background: var(--c--contextuals--background--surface--secondary);
        }
        button:focus-visible, input:focus-visible, select:focus-visible {
          outline: 2px solid var(--c--contextuals--background--semantic--brand--primary, #000091);
          outline-offset: 2px;
        }
        button:disabled { cursor: default; opacity: 0.45; }
        .debug-dismiss {
          float: right;
          width: 28px;
          height: 28px;
          padding: 0;
          border: 0;
          background: transparent;
          font-size: 20px;
          font-weight: 400;
          color: var(--c--contextuals--content--semantic--neutral--secondary);
        }
        .debug-presets { display: flex; gap: 6px; }
        .debug-presets button {
          flex: 1;
          padding: 6px 8px;
          font-size: 12px;
          white-space: nowrap;
        }
        .debug-presets button[aria-pressed='true'] {
          border-color: var(--c--contextuals--background--semantic--brand--primary, #000091);
          color: var(--c--contextuals--background--semantic--brand--primary, #000091);
          background: var(--c--contextuals--background--surface--secondary);
        }
        .debug-actions { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
        .debug-apply {
          background: var(--c--contextuals--background--semantic--brand--primary, #000091);
          border-color: transparent;
          color: #fff;
        }
        .debug-apply:hover:not(:disabled) {
          background: var(--c--contextuals--background--semantic--brand--primary-hover, #1212aa);
        }
        .debug-create { width: 100%; }
        .debug-checkpoint {
          border-top: 1px solid var(--c--contextuals--border--surface--primary);
          padding-top: 14px;
        }
        small {
          display: block;
          font-size: 11px;
          line-height: 1.5;
          color: var(--c--contextuals--content--semantic--neutral--secondary);
        }
        .debug-checkpoint small { margin-top: 8px; }
        [role='status']:not(:empty) {
          margin-top: 12px;
          padding: 8px 10px;
          border-radius: 6px;
          background: var(--c--contextuals--background--surface--secondary);
          font-size: 12px;
        }
      `}
    >
      <summary>
        {t('History debug')}
        <button
          type="button"
          aria-label={t('Dismiss history debug panel')}
          className="debug-dismiss"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDismiss();
          }}
        >
          ×
        </button>
      </summary>
      <fieldset disabled={busy}>
        <Box $gap="14px">
          <div className="debug-fields">
            <div className="debug-field debug-group">
              <label htmlFor="history-debug-group">{t('Group by')}</label>
              <div className="debug-duration">
                <input
                  id="history-debug-group"
                  type="number"
                  min={1 / unit}
                  step="any"
                  value={settings.groupMaxGap / unit || ''}
                  onChange={(event) => {
                    const duration = Number(event.target.value) * unit;
                    setSettings({
                      ...settings,
                      groupMaxGap: duration,
                      groupMaxDuration: duration,
                    });
                  }}
                />
                <select
                  aria-label={t('Grouping time unit')}
                  value={unit}
                  onChange={(event) => setUnit(Number(event.target.value))}
                >
                  <option value={1000}>{t('seconds')}</option>
                  <option value={60_000}>{t('minutes')}</option>
                </select>
              </div>
            </div>
            <div className="debug-field">
              <label htmlFor="history-debug-limit">{t('Row limit')}</label>
              <input
                id="history-debug-limit"
                type="number"
                min={1}
                max={1000}
                value={settings.limit || ''}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    limit: Number(event.target.value),
                  })
                }
              />
            </div>
          </div>
          <div className="debug-presets">
            <button
              type="button"
              aria-pressed={
                settings.groupMaxGap ===
                  HISTORY_DEBUG_PRESETS.fine.groupMaxGap &&
                settings.groupMaxDuration ===
                  HISTORY_DEBUG_PRESETS.fine.groupMaxDuration
              }
              onClick={() => {
                setSettings({ ...settings, ...HISTORY_DEBUG_PRESETS.fine });
                setUnit(1000);
              }}
            >
              {t('Fine-grained')}
            </button>
            <button
              type="button"
              aria-pressed={
                settings.groupMaxGap ===
                  HISTORY_DEBUG_PRESETS.sessions.groupMaxGap &&
                settings.groupMaxDuration ===
                  HISTORY_DEBUG_PRESETS.sessions.groupMaxDuration
              }
              onClick={() => {
                setSettings({ ...settings, ...HISTORY_DEBUG_PRESETS.sessions });
                setUnit(60_000);
              }}
            >
              {t('Editing sessions')}
            </button>
          </div>
          {settings.groupMaxGap !== settings.groupMaxDuration && (
            <small>
              {t('Pause: {{pause}} s · Span: {{span}} s', {
                pause: settings.groupMaxGap / 1000,
                span: settings.groupMaxDuration / 1000,
              })}
            </small>
          )}
          <small>
            {t('Row limit is per page; the beginning stays pinned.')}
          </small>
          <div className="debug-actions">
            <button
              type="button"
              className="debug-apply"
              disabled={!valid}
              onClick={() =>
                void run(() => onApply(settings), t('Grouping updated.'))
              }
            >
              {t('Apply')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSettings(defaults);
                setUnit(60_000);
                void run(() => onApply(defaults), t('Defaults restored.'));
              }}
            >
              {t('Reset')}
            </button>
          </div>
          <div className="debug-checkpoint">
            <button
              type="button"
              className="debug-create"
              disabled={!canCreate}
              onClick={() => void run(onCreate, t('Test version created.'))}
            >
              {t('Create test version')}
            </button>
            <small>
              {t('Local settings. Test versions are saved to the document.')}
            </small>
          </div>
        </Box>
      </fieldset>
      <small role="status" aria-live="polite">
        {busy ? t('Loading…') : message}
      </small>
    </Box>
  );
};
