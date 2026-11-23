import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { NotificationCenter } from './NotificationCenter';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { Topbar } from './Topbar';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  logout: vi.fn(),
  selectOrganization: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      publicId: 'USR-1',
      email: 'test@example.com',
      fullName: 'Test User',
      status: 'ACTIVE',
      roles: ['PLATFORM_ADMIN'],
      permissions: [],
      memberships: [
        { organizationId: 10, organizationName: 'First bank', role: 'BLOOD_BANK_ADMIN' },
        { organizationId: 20, organizationName: 'Second bank', role: 'HOSPITAL_ADMIN' },
      ],
    },
    status: 'authenticated',
    organizationId: 20,
    login: vi.fn(),
    register: vi.fn(),
    logout: mocks.logout,
    refresh: vi.fn(),
    changePassword: vi.fn(),
    selectOrganization: mocks.selectOrganization,
    setUser: vi.fn(),
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasRole: (role: string) => role === 'PLATFORM_ADMIN',
    canAccess: () => true,
  }),
}));

vi.mock('@/lib/api', () => ({
  api: { get: mocks.apiGet, post: vi.fn() },
  getErrorMessage: (error: unknown) => String(error),
}));

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.apiGet.mockImplementation(async (path: string) => {
    if (path.includes('unread-count')) return 0;
    return { content: [], totalElements: 0, totalPages: 0, size: 8, number: 0 };
  });
});

describe('organization switcher keyboard behaviour', () => {
  it('lets Tab advance between options and Escape close with focus restored', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationSwitcher />);
    const trigger = screen.getByRole('button', { name: /Active organization/ });

    await user.click(trigger);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveFocus();

    await user.tab();
    expect(options[1]).toHaveFocus();
    expect(screen.getByRole('listbox', { name: 'Active organization' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('notification popover keyboard behaviour', () => {
  it('does not prevent Tab and still closes on Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationCenter />);
    const trigger = screen.getByRole('button', { name: /Notifications/ });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' });
    const viewAll = await waitFor(() => screen.getByRole('link', { name: /View all notifications/ }));

    await user.tab();
    expect(viewAll).toHaveFocus();
    expect(dialog).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('topbar keyboard behaviour', () => {
  it('lets Tab move through the user menu and closes it on Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Topbar onOpenMobileMenu={() => undefined} />);
    const trigger = screen.getByRole('button', { name: 'Open user menu' });

    await user.click(trigger);
    const menu = screen.getByRole('menu', { name: 'User menu' });
    const items = within(menu).getAllByRole('menuitem');
    expect(items.length).toBeGreaterThan(0);

    await user.tab();
    expect(items[0]).toHaveFocus();
    expect(menu).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: 'User menu' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('exposes search suggestions as ordinary buttons rather than a listbox', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Topbar onOpenMobileMenu={() => undefined} />);
    const input = screen.getByRole('searchbox', { name: 'Search sections' });

    await user.type(input, 'dona');
    const results = screen.getByRole('navigation', { name: 'Section results' });
    expect(within(results).queryByRole('listbox')).not.toBeInTheDocument();
    const buttons = within(results).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => expect(button).not.toHaveAttribute('role'));

    await user.tab();
    expect(buttons[0]).toHaveFocus();
  });
});
