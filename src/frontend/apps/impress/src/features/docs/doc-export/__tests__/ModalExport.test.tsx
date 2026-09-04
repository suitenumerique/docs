import { VariantType } from '@gouvfr-lasuite/ui-components';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { type Doc } from '@/docs/doc-management/types';
import { AppWrapper } from '@/tests/utils';

import { ModalExport } from '../components/ModalExport';

const mocks = vi.hoisted(() => ({
  addMediaFilesToMarkdownZip: vi.fn(),
  docToBlob: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@gouvfr-lasuite/ui-components', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gouvfr-lasuite/ui-components')>();

  return {
    ...actual,
    useToastProvider: () => ({ toast: mocks.toast }),
  };
});

vi.mock('@/core', () => ({
  useMediaUrl: () => 'https://media.test',
}));

vi.mock('@/docs/doc-editor/stores/useEditorStore', () => ({
  useEditorStore: () => ({
    editor: {
      document: [],
      blocksToMarkdownLossy: vi.fn(),
    },
  }),
}));

vi.mock('@/docs/doc-management', () => ({
  useTrans: () => ({ untitledDocument: 'Untitled document' }),
}));

vi.mock('../hooks/', () => ({
  default: {
    useExportAGPL: () => ({
      formats: [{ label: 'PDF', value: 'pdf', labelDescription: '.pdf' }],
      docToBlob: mocks.docToBlob,
    }),
  },
}));

vi.mock('../utils_markdown', () => ({
  addMediaFilesToMarkdownZip: mocks.addMediaFilesToMarkdownZip,
}));

describe('ModalExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.docToBlob.mockResolvedValue(undefined);
  });

  test('clears the loading state when Markdown media export fails', async () => {
    let rejectMediaExport: (reason: Error) => void = () => undefined;
    mocks.addMediaFilesToMarkdownZip.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectMediaExport = reject;
        }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ModalExport doc={{ title: 'Roadmap' } as Doc} onClose={onClose} />,
      { wrapper: AppWrapper },
    );

    await user.click(screen.getByRole('combobox', { name: 'Format' }));
    await user.click(screen.getByRole('option', { name: /Markdown/ }));

    const downloadButton = screen.getByTestId('doc-export-download-button');
    await user.click(downloadButton);
    await waitFor(() => expect(downloadButton).toBeDisabled());

    await act(async () => {
      rejectMediaExport(new Error('Media export failed'));
    });

    await waitFor(() => expect(downloadButton).toBeEnabled());
    expect(mocks.toast).toHaveBeenCalledWith(
      'The export failed',
      VariantType.ERROR,
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
