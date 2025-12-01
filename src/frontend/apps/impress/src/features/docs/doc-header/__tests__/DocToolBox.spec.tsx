import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { DocToolBox } from '../components/DocToolBox';

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

beforeEach(() => {
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'false';
});

describe('DocToolBox options', () => {
  test('shows "Copy as Markdown" option and no longer shows "Copy as HTML"', async () => {
    render(<DocToolBox doc={doc as any} />, {
      wrapper: AppWrapper,
    });

    const optionsButton = await screen.findByLabelText(
      'Open the document options',
    );
    await userEvent.click(optionsButton);

    expect(await screen.findByText('Copy as Markdown')).toBeInTheDocument();
    expect(screen.queryByText('Copy as HTML')).not.toBeInTheDocument();
  });
});
