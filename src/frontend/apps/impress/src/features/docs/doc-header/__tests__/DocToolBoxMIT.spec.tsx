import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { AppWrapper } from '@/tests/utils';

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

it('DocToolBox dynamic import: loads DocToolBox when NEXT_PUBLIC_PUBLISH_AS_MIT is true', async () => {
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'true';

  const { DocToolBox } = await import('../components/DocToolBox');

  render(<DocToolBox doc={doc as any} />, {
    wrapper: AppWrapper,
  });

  await waitFor(
    () => {
      expect(screen.queryByText('download')).not.toBeInTheDocument();
    },
    {
      timeout: 1000,
    },
  );
});
