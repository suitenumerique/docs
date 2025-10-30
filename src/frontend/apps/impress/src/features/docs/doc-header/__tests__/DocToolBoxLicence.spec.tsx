import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterAll, beforeEach, describe, expect, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

const originalEnv = process.env.NEXT_PUBLIC_PUBLISH_AS_MIT;

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const doc = {
  nb_accesses: 1,
  abilities: {
    versions_list: true,
    destroy: true,
  },
};

describe('DocToolBox - Licence', () => {
  afterAll(() => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = originalEnv;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('The export button is rendered when MIT version is deactivated', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'false';

    const { DocToolBox } = await import('../components/DocToolBox');

    render(<DocToolBox doc={doc as any} />, {
      wrapper: AppWrapper,
    });
    const optionsButton = await screen.findByLabelText('Export the document');
    await userEvent.click(optionsButton);
    expect(
      await screen.findByText(
        'Download your document in a .docx, .odt or .pdf format.',
      ),
    ).toBeInTheDocument();
  }, 10000);

  test('The export button is not rendered when MIT version is activated', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'true';

    const { DocToolBox } = await import('../components/DocToolBox');

    render(<DocToolBox doc={doc as any} />, {
      wrapper: AppWrapper,
    });

    expect(
      screen.getByLabelText('Open the document options'),
    ).toBeInTheDocument();

    expect(
      screen.queryByLabelText('Export the document'),
    ).not.toBeInTheDocument();
  });
});
