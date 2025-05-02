import { render, screen } from '@testing-library/react';
import React from 'react';

import { AppWrapper } from '@/tests/utils';

import { DocToolBox } from '../components/DocToolBox';

const doc = {
  nb_accesses: 1,
  abilities: {
    versions_list: true,
    destroy: true,
  },
};

jest.mock('@/features/docs/doc-export/', () => ({
  ModalExport: () => <span>ModalExport</span>,
}));

it('DocToolBox dynamic import: loads DocToolBox when MIT_ONLY is false', async () => {
  process.env.MIT_ONLY = 'false';

  render(<DocToolBox doc={doc as any} />, {
    wrapper: AppWrapper,
  });

  expect(await screen.findByText('download')).toBeInTheDocument();
});
