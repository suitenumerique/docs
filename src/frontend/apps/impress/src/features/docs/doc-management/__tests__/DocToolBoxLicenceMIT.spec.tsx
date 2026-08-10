import { render, screen } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, vi } from 'vitest';

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

describe('DocToolBox - Licence MIT', () => {
  afterAll(() => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = originalEnv;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('The export button is not rendered when MIT version is activated', async () => {
    process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'true';

    const { AppWrapper } = await import('@/tests/utils');
    const { DocToolBox } = await import('../components/DocToolBox');

    render(<DocToolBox doc={doc as any} />, {
      wrapper: AppWrapper,
    });

    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  }, 15000);
});
