import { render, screen } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

const originalEnv = process.env.NEXT_PUBLIC_PUBLISH_AS_MIT;

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/docs/doc-1',
  }),
}));

vi.mock('@gouvfr-lasuite/ui-kit', async () => {
  const actual = await vi.importActual('@gouvfr-lasuite/ui-kit');
  return {
    ...actual,
    DropdownMenu: ({ options, children }: any) => (
      <>
        {children}
        <ul>
          {options
            .filter((o: any) => !o.isHidden)
            .map((o: any) => (
              <li key={o.label}>{o.label}</li>
            ))}
        </ul>
      </>
    ),
  };
});

vi.mock('../hooks/useCopyCurrentEditorToClipboard', () => ({
  useCopyCurrentEditorToClipboard: () => vi.fn(),
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

    expect(await screen.findByText('Download')).toBeInTheDocument();
  }, 15000);

  test('The export button is not rendered when MIT version is activated', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'true';

    const { DocToolBox } = await import('../components/DocToolBox');

    render(<DocToolBox doc={doc as any} />, {
      wrapper: AppWrapper,
    });

    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  }, 15000);
});
