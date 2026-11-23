import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, Search, XCircle } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { COMPONENT_TYPES, DONATION_STATUSES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { formatDateTime, humanize } from '@/lib/utils';
import {
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  Modal,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import type { BloodUnitView, ComponentType, DonationView } from '@/types/domain';

type ActionKind = 'screen' | 'approve' | 'reject' | null;

export function DonationsPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<DonationView | null>(null);
  const [action, setAction] = useState<ActionKind>(null);
  const [screening, setScreening] = useState({ passed: true, notes: '' });
  const [reason, setReason] = useState('');
  const [components, setComponents] = useState<ComponentType[]>(['RED_CELLS']);

  const donationsQuery = useQuery({
    queryKey: ['donations', 'list'],
    queryFn: () => api.get<DonationView[]>('/donations'),
  });

  const unitsQuery = useQuery({
    queryKey: ['donations', selected?.id, 'units'],
    queryFn: () => api.get<BloodUnitView[]>(`/donations/${selected?.id}/units`),
    enabled: selected !== null,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['donations'] });

  const mutation = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: 'approve' | 'reject' | 'screen' }) => {
      if (kind === 'screen') {
        return api.post(`/donations/${id}/screen`, {
          passed: screening.passed,
          notes: screening.notes.trim(),
        });
      }
      if (kind === 'reject') return api.post(`/donations/${id}/reject`, { reason: reason.trim() });
      return api.post(`/donations/${id}/approve`, { components });
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.kind === 'approve'
          ? 'Donation approved and units created'
          : variables.kind === 'reject'
            ? 'Donation rejected'
            : 'Screening recorded',
      );
      setAction(null);
      setScreening({ passed: true, notes: '' });
      setReason('');
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error) => toast.error('Action failed', getErrorMessage(error)),
  });

  const units = unitsQuery.data ?? [];

  const allDonations = donationsQuery.data ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const donations = allDonations.filter((donation) => {
    const matchesTerm = !term ||
      `${donation.publicId ?? ''} ${donation.donorName ?? ''} ${donation.donorId}`.toLowerCase().includes(term);
    return matchesTerm && (!status || donation.status.toUpperCase() === status);
  });

  const openAction = (kind: Exclude<ActionKind, null>, donation: DonationView) => {
    setSelected(donation);
    setAction(kind);
  };

  const columns: DataTableColumn<DonationView>[] = [
    {
      key: 'id',
      header: 'Donation',
      render: (donation) => (
        <div>
          <div className="table-cell-strong mono">{donation.publicId ?? `DON-${donation.id}`}</div>
          <div className="text-xs text-subtle">Donor #{donation.donorId}</div>
        </div>
      ),
    },
    { key: 'donorName', header: 'Donor', render: (donation) => donation.donorName ?? `Donor #${donation.donorId}` },
    { key: 'status', header: 'Status', render: (donation) => <StatusBadge status={donation.status} /> },
    { key: 'donatedAt', header: 'Donated', render: (donation) => formatDateTime(donation.donatedAt) },
    { key: 'organizationId', header: 'Organization', render: (donation) => donation.organizationId },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (donation) => (
        <div className="table-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(donation)}>View</button>
          {auth.hasPermission(PERMISSIONS.SCREENING_REVIEW) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAction('screen', donation)}>
              Screen
            </button>
          )}
          {auth.hasPermission(PERMISSIONS.DONATION_APPROVE) && donation.status.toUpperCase() !== 'REJECTED' && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openAction('approve', donation)}>
                Approve
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => openAction('reject', donation)}>
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Donations"
        description="Review screening outcomes, approve eligible donations, and trace the units they create."
      />

      <DataTable
        ariaLabel="Donation list"
        rowKey={(row) => row.id}
        columns={columns}
        rows={donations}
        loading={donationsQuery.isPending}
        onRowClick={setSelected}
        emptyTitle="No donations found"
        emptyDescription="Adjust the filters or check back after new donations are recorded."
        toolbar={
          <>
            <div className="search-input-wrap">
              <Search size={15} aria-hidden="true" />
              <input
                className="input"
                type="search"
                aria-label="Search donations"
                placeholder="Search donations…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <label className="sr-only" htmlFor="donation-status">Donation status</label>
            <select id="donation-status" className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {DONATION_STATUSES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </select>
          </>
        }
      />
      {donationsQuery.isError && (
        <div className="card" style={{ marginTop: 16 }}>
          <ErrorState error={donationsQuery.error} onRetry={() => void donationsQuery.refetch()} />
        </div>
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Donation ${selected.publicId ?? `#${selected.id}`}` : 'Donation'}
        description={selected?.donorName}
      >
        {selected && (
          <>
            <dl className="detail-grid">
              <div className="detail-item"><dt>Status</dt><dd><StatusBadge status={selected.status} /></dd></div>
              <div className="detail-item"><dt>Donor ID</dt><dd>{selected.donorId}</dd></div>
              <div className="detail-item"><dt>Organization ID</dt><dd>{selected.organizationId}</dd></div>
              <div className="detail-item"><dt>Appointment ID</dt><dd>{selected.appointmentId ?? '—'}</dd></div>
              <div className="detail-item"><dt>Donated</dt><dd>{formatDateTime(selected.donatedAt)}</dd></div>
              <div className="detail-item"><dt>Public ID</dt><dd className="mono">{selected.publicId ?? '—'}</dd></div>
              {selected.notes && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}><dt>Notes</dt><dd>{selected.notes}</dd></div>
              )}
            </dl>

            <hr className="divider" />
            <h3>Resulting units</h3>
            {unitsQuery.isPending && <Skeleton height={60} />}
            {unitsQuery.isError && <ErrorState error={unitsQuery.error} />}
            {unitsQuery.isSuccess && units.length === 0 && (
              <EmptyState title="No units yet" description="Units appear here after an approved donation." />
            )}
            {units.map((unit) => (
              <div className="item-header" key={unit.id}>
                <div>
                  <strong className="mono">{unit.unitNumber}</strong>
                  <div className="text-xs text-muted">{humanize(unit.bloodGroup)} · {humanize(unit.componentType)}</div>
                </div>
                <StatusBadge status={unit.status} />
              </div>
            ))}

            <div className="action-row">
              {auth.hasPermission(PERMISSIONS.SCREENING_REVIEW) && (
                <button type="button" className="btn btn-secondary" onClick={() => openAction('screen', selected)}>
                  <ClipboardCheck size={15} aria-hidden="true" /> Record screening
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.DONATION_APPROVE) && selected.status.toUpperCase() !== 'REJECTED' && (
                <button type="button" className="btn btn-primary" onClick={() => openAction('approve', selected)}>
                  <CheckCircle2 size={15} aria-hidden="true" /> Approve donation
                </button>
              )}
            </div>
          </>
        )}
      </Drawer>

      <Modal
        open={action === 'screen'}
        onClose={() => setAction(null)}
        title="Record screening result"
        description="Screening is submitted to the donations API."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={mutation.isPending || !screening.notes.trim()}
              onClick={() => selected && mutation.mutate({ id: selected.id, kind: 'screen' })}
            >
              Save screening
            </button>
          </>
        }
      >
        <div className="inline-form">
          <label className="checkbox-row">
            <input type="checkbox" checked={screening.passed} onChange={(event) => setScreening({ ...screening, passed: event.target.checked })} />
            Screening passed
          </label>
          <FormField label="Notes" required full>
            <textarea className="textarea" value={screening.notes} onChange={(event) => setScreening({ ...screening, notes: event.target.value })} />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={action === 'approve'}
        onClose={() => setAction(null)}
        title="Approve donation"
        description="Choose the components that the API should create as quarantined blood units."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={mutation.isPending || components.length === 0}
              onClick={() => selected && mutation.mutate({ id: selected.id, kind: 'approve' })}
            >
              Approve and create units
            </button>
          </>
        }
      >
        <FormField label="Components" hint="At least one component is required" required full>
          <div className="cluster">
            {COMPONENT_TYPES.map((component) => (
              <label className="checkbox-row" key={component}>
                <input
                  type="checkbox"
                  checked={components.includes(component)}
                  onChange={(event) => setComponents((current) =>
                    event.target.checked ? [...current, component] : current.filter((item) => item !== component))}
                />
                {humanize(component)}
              </label>
            ))}
          </div>
        </FormField>
      </Modal>

      <Modal
        open={action === 'reject'}
        onClose={() => setAction(null)}
        title="Reject donation"
        description="A reason is required and will be attached to the donation record."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={mutation.isPending || !reason.trim()}
              onClick={() => selected && mutation.mutate({ id: selected.id, kind: 'reject' })}
            >
              <XCircle size={15} aria-hidden="true" /> Reject donation
            </button>
          </>
        }
      >
        <FormField label="Reason" required full>
          <textarea className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
      </Modal>
    </>
  );
}
