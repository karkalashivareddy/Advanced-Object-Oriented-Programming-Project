import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { tokenStore } from '@/lib/tokenStore';
import { DataTable } from './DataTable';
import { FreshnessIndicator } from './FreshnessIndicator';
import { FormField } from './FormField';
import { Modal } from './Modal';
import { StatusBadge, toneForStatus } from './StatusBadge';

afterEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
});

describe('StatusBadge', () => {
  it('maps lifecycle statuses to accessible tones', () => {
    expect(toneForStatus('AVAILABLE')).toBe('success');
    expect(toneForStatus('QUARANTINED')).toBe('warning');
    expect(toneForStatus('EXPIRED')).toBe('danger');
    expect(toneForStatus('RESERVED')).toBe('info');
    render(<StatusBadge status="AVAILABLE" />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('maps donation, donor, and dispatch states', () => {
    expect(toneForStatus('SCREENED')).toBe('teal');
    expect(toneForStatus('TEMPORARILY_UNAVAILABLE')).toBe('warning');
    expect(toneForStatus('UNAVAILABLE')).toBe('danger');
    expect(toneForStatus('IN_TRANSIT')).toBe('info');
    expect(toneForStatus('INCIDENT')).toBe('danger');
  });
});

describe('FormField', () => {
  it('associates the label, hint, and error with the control', () => {
    render(
      <FormField label="Email" hint="Work email" error="Email is required." required>
        <input type="email" />
      </FormField>,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('hint');
    expect(input.getAttribute('aria-describedby')).toContain('error');
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required.');
  });
});

describe('Modal', () => {
  it('traps focus, labels the dialog, and closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm action" description="Test dialog">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Confirm action' });
    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(closeButton).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('accepts an external aria-labelledby target', () => {
    render(
      <>
        <h2 id="custom-title">External title</h2>
        <Modal open onClose={() => undefined} title="Confirm" labelledBy="custom-title">
          <p>Body</p>
        </Modal>
      </>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'custom-title');
  });
});

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Name', render: (row: { name: string }) => row.name, sortable: true },
  ];

  it('renders an empty state when there are no rows', () => {
    render(
      <DataTable
        ariaLabel="Test table"
        columns={columns}
        rows={[]}
        rowKey={(row) => row.name}
        emptyTitle="No records"
      />,
    );
    expect(screen.getByText('No records')).toBeInTheDocument();
  });

  it('reports sort requests through the callback', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <DataTable
        ariaLabel="Test table"
        columns={columns}
        rows={[{ name: 'Alpha' }]}
        rowKey={(row) => row.name}
        onSort={onSort}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith('name');
    expect(within(screen.getByRole('table', { name: 'Test table' })).getByText('Alpha')).toBeInTheDocument();
  });

  it('renders a caption and ignores keyboard activation from nested controls', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        ariaLabel="Units"
        caption="Available units"
        columns={[
          { key: 'action', header: 'Action', render: () => <button type="button">Nested action</button> },
        ]}
        rows={[{ name: 'Alpha' }]}
        rowKey={(row) => row.name}
        onRowClick={onRowClick}
      />,
    );

    expect(screen.getByText('Available units')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Units' });
    const nested = within(table).getByRole('button', { name: 'Nested action' });
    const row = nested.closest('tr');
    expect(row).not.toBeNull();

    fireEvent.keyDown(nested, { key: 'Enter' });
    expect(onRowClick).not.toHaveBeenCalled();

    fireEvent.keyDown(row!, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});

describe('FreshnessIndicator', () => {
  it('shows relative freshness and exposes a manual refresh control', () => {
    const onRefresh = vi.fn();
    render(<FreshnessIndicator updatedAt={new Date(Date.now() - 12_000).toISOString()} onRefresh={onRefresh} />);
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
    const refresh = screen.getByRole('button', { name: 'Refresh data' });
    fireEvent.click(refresh);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('organization-scoped API requests', () => {
  it('sends X-Organization-Id on every request when a scope is active', async () => {
    tokenStore.setOrganizationId(42);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ success: true, data: { ok: true }, correlationId: 'corr', timestamp: '' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/inventory');

    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get('X-Organization-Id')).toBe('42');
  });
});
