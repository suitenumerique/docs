import { render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { UserReconciliation } from '../components/UserReconciliation';

vi.mock('../assets/mail-check-filled.svg', () => ({
  default: () => <div data-testid="success-svg">SuccessSvg</div>,
}));

describe('UserReconciliation', () => {
  beforeEach(() => {
    fetchMock.reset();
  });

  ['active', 'inactive'].forEach((type) => {
    test(`renders when reconciliation is a ${type} success`, async () => {
      fetchMock.get(
        `http://test.jest/api/v1.0/user-reconciliations/${type}/123456/`,
        { details: 'Success' },
      );

      render(
        <UserReconciliation
          type={type as 'active' | 'inactive'}
          reconciliationId="123456"
        />,
        {
          wrapper: AppWrapper,
        },
      );

      await waitFor(() => {
        expect(fetchMock.calls().length).toBe(1);
      });

      expect(
        await screen.findByText(
          /To complete the unification of your user accounts/i,
        ),
      ).toBeInTheDocument();
    });
  });

  test('renders when reconciliation fails', async () => {
    fetchMock.get(
      `http://test.jest/api/v1.0/user-reconciliations/active/invalid-id/`,
      {
        throws: new Error('invalid id'),
      },
    );

    render(<UserReconciliation type="active" reconciliationId="invalid-id" />, {
      wrapper: AppWrapper,
    });

    await waitFor(() => {
      expect(fetchMock.calls().length).toBe(1);
    });

    expect(
      await screen.findByText(/An error occurred during email validation./i),
    ).toBeInTheDocument();
  });
});
