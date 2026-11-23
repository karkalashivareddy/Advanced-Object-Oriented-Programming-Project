import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import { FormField } from './FormField';
import { Modal } from './Modal';
import { StatusBadge, toneForStatus } from './StatusBadge';

describe('StatusBadge', () => {
  it('maps lifecycle statuses to accessible tones', () => {
    expect(toneForStatus('AVAILABLE')).toBe('success');
    expect(toneForStatus('QUARANTINED')).toBe('warning');
    expect(toneForStatus('EXPIRED')).toBe('danger');
    expect(toneForStatus('RESERVED')).toBe('info');
    render(<StatusBadge status="AVAILABLE" />);
    expect(screen.getByText('Available')).toBeInTheDocument();
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
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
});
