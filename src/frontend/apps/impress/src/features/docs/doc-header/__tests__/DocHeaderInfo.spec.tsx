import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

// Force mobile layout so the children count is rendered
vi.mock('@/stores', () => ({
  useResponsiveStore: () => ({ isDesktop: false }),
}));

// Provide stable mocks for hooks used by the component
vi.mock('../../doc-management', async () => {
  const actual = await vi.importActual<any>('../../doc-management');
  return {
    ...actual,
    useTrans: () => ({ transRole: vi.fn((r) => String(r)) }),
    useIsCollaborativeEditable: () => ({ isEditable: true }),
  };
});

vi.mock('@/core', () => ({
  useConfig: () => ({ data: {} }),
}));

vi.mock('@/hook', () => ({
  useDate: () => ({
    relativeDate: () => 'yesterday',
    calculateDaysLeft: () => 5,
  }),
}));

import { DocHeaderInfo } from '../components/DocHeaderInfo';

describe('DocHeaderInfo', () => {
  test('renders the number of sub-documents when numchild is provided (mobile layout)', () => {
    const doc = {
      numchild: 3,
      updated_at: new Date().toISOString(),
    } as any;

    render(<DocHeaderInfo doc={doc} />, { wrapper: AppWrapper });

    expect(screen.getByText(/Contains 3 sub-documents/i)).toBeInTheDocument();
  });
});
