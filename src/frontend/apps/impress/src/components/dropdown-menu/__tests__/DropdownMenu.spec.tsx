import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { DropdownMenu, DropdownMenuOption } from '../DropdownMenu';

const mockAddLastFocus = vi.fn();
vi.mock('@/stores', () => ({
  useFocusStore: (selector: any) =>
    selector({ addLastFocus: mockAddLastFocus }),
  useResponsiveStore: () => ({ isDesktop: true }),
}));

const baseOptions: DropdownMenuOption[] = [
  { label: 'English', callback: vi.fn() },
  { label: 'Français', callback: vi.fn() },
  { label: 'Deutsch', callback: vi.fn() },
];

const selectableOptions: DropdownMenuOption[] = [
  { label: 'English', isSelected: false, callback: vi.fn() },
  { label: 'Français', isSelected: true, callback: vi.fn() },
  { label: 'Deutsch', isSelected: false, callback: vi.fn() },
];

describe('<DropdownMenu />', () => {
  test('renders menuitem role when options have no selection', async () => {
    render(
      <DropdownMenu options={baseOptions} label="Options" opened>
        Open menu
      </DropdownMenu>,
      { wrapper: AppWrapper },
    );

    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    items.forEach((item) => {
      expect(item).not.toHaveAttribute('aria-checked');
    });
  });

  test('renders menuitemradio role with aria-checked when options have isSelected', async () => {
    render(
      <DropdownMenu options={selectableOptions} label="Select language" opened>
        Français
      </DropdownMenu>,
      { wrapper: AppWrapper },
    );

    const radios = screen.getAllByRole('menuitemradio');
    expect(radios).toHaveLength(3);

    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
  });

  test('renders menuitemcheckbox role with aria-checked when selectedValues is provided', async () => {
    const optionsWithValues: DropdownMenuOption[] = [
      { label: 'English', value: 'en', callback: vi.fn() },
      { label: 'Français', value: 'fr', callback: vi.fn() },
      { label: 'Deutsch', value: 'de', callback: vi.fn() },
    ];

    render(
      <DropdownMenu
        options={optionsWithValues}
        selectedValues={['fr']}
        label="Select language"
        opened
      >
        Français
      </DropdownMenu>,
      { wrapper: AppWrapper },
    );

    const checkboxes = screen.getAllByRole('menuitemcheckbox');
    expect(checkboxes).toHaveLength(3);

    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'false');
    expect(checkboxes[1]).toHaveAttribute('aria-checked', 'true');
    expect(checkboxes[2]).toHaveAttribute('aria-checked', 'false');
  });

  test('trigger button has aria-haspopup and aria-expanded', async () => {
    render(
      <DropdownMenu options={baseOptions} label="Select language">
        Français
      </DropdownMenu>,
      { wrapper: AppWrapper },
    );

    const trigger = screen.getByRole('button', { name: 'Select language' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  test('displays check icon for selected item', async () => {
    render(
      <DropdownMenu options={selectableOptions} label="Select language" opened>
        Français
      </DropdownMenu>,
      { wrapper: AppWrapper },
    );

    const menu = screen.getByRole('menu');
    const checkedItem = within(menu).getAllByRole('menuitemradio')[1];
    expect(checkedItem).toHaveAttribute('aria-checked', 'true');
    expect(within(checkedItem).getByText('Français')).toBeInTheDocument();
  });
});
