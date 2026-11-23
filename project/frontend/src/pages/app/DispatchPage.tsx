import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ambulance, KeyRound, Plus, Search, TriangleAlert } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DISPATCH_STATUSES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { formatDateTime, humanize } from '@/lib/utils';
import {
  DataTable,
  ErrorState,
  FormField,
  Modal,
  PageHeader,
  StatusBadge,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import type { DispatchView, ReservationView } from '@/types/domain';

type DialogKind = 'create' | 'deliver' | 'incident' | null;

export function DispatchPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reservationId, setReservationId] = useState('');
  const [assignedStaff, setAssignedStaff] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [incident, setIncident] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The dispatch and reservation APIs return lists without search/status/page params.
  const dispatchQuery = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => api.get<DispatchView[]>('/dispatches'),
  });

  const reservationsQuery = useQuery({
    queryKey: ['reservations'],
    queryFn: () => api.get<ReservationView[]>('/reservations'),
    enabled: dialog === 'create' && auth.hasPermission(PERMISSIONS.RESERVATION_READ),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['dispatches'] });
    void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const mutation = useMutation({
    mutationFn: ({ id, kind }: { id: number | null; kind: 'create' | 'depart' | 'deliver' | 'incident' }) => {
      if (kind === 'create') {
        return api.post<DispatchView>('/dispatches', {
          reservationId: Number(reservationId),
          assignedStaff: assignedStaff.trim(),
        }, { idempotencyKey });
      }
      if (kind === 'depart') return api.post(`/dispatches/${id}/depart`);
      if (kind === 'deliver') return api.post(`/dispatches/${id}/deliver`, { recipientName: recipientName.trim() });
      return api.post(`/dispatches/${id}/incident`, { description: incident.trim() });
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.kind === 'create'
          ? 'Dispatch created'
          : variables.kind === 'depart'
            ? 'Dispatch marked in transit'
            : variables.kind === 'deliver'
              ? 'Delivery recorded'
              : 'Incident reported',
      );
      setDialog(null);
      setActiveId(null);
      setRecipientName('');
      setIncident('');
      setReservationId('');
      setAssignedStaff('');
      setErrors({});
      invalidate();
    },
    onError: (error) => toast.error('Action failed', getErrorMessage(error)),
  });

  const submitDialog = () => {
    const next: Record<string, string> = {};
    if (dialog === 'create') {
      if (!/^\d+$/.test(reservationId)) next.reservationId = 'Choose a reservation.';
      if (!assignedStaff.trim()) next.assignedStaff = 'Assigned staff is required.';
    }
    if (dialog === 'deliver' && !recipientName.trim()) next.recipientName = 'Recipient name is required.';
    if (dialog === 'incident' && !incident.trim()) next.incident = 'Description is required.';
    setErrors(next);
    if (Object.keys(next).length === 0) {
      mutation.mutate({ id: activeId, kind: dialog as 'create' | 'deliver' | 'incident' });
    }
  };

  const openDialog = (kind: Exclude<DialogKind, null>, id: number | null = null) => {
    setDialog(kind);
    setActiveId(id);
    setErrors({});
    if (kind === 'create') {
      setIdempotencyKey(api.createIdempotencyKey());
      setReservationId('');
      setAssignedStaff('');
    }
  };

  const columns: DataTableColumn<DispatchView>[] = [
    {
      key: 'id',
      header: 'Dispatch',
      render: (dispatch) => (
        <div>
          <div className="table-cell-strong mono">{dispatch.publicId ?? `DSP-${dispatch.id}`}</div>
          <div className="text-xs text-subtle">Reservation #{dispatch.reservationId}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (dispatch) => <StatusBadge status={dispatch.status} /> },
    { key: 'assignedStaff', header: 'Assigned staff', render: (dispatch) => dispatch.assignedStaff },
    { key: 'recipient', header: 'Recipient', render: (dispatch) => dispatch.recipientName ?? '—' },
    { key: 'dispatchedAt', header: 'Departed', render: (dispatch) => formatDateTime(dispatch.dispatchedAt) },
    { key: 'deliveredAt', header: 'Delivered', render: (dispatch) => formatDateTime(dispatch.deliveredAt) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (dispatch) => {
        if (!auth.hasPermission(PERMISSIONS.DISPATCH_MANAGE)) return '—';
        const currentStatus = dispatch.status.toUpperCase();
        return (
          <div className="table-actions">
            {currentStatus === 'PREPARING' && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: dispatch.id, kind: 'depart' })}>
                <Ambulance size={13} aria-hidden="true" /> Depart
              </button>
            )}
            {['IN_TRANSIT', 'INCIDENT'].includes(currentStatus) && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openDialog('deliver', dispatch.id)}>Deliver</button>
            )}
            {currentStatus !== 'DELIVERED' && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => openDialog('incident', dispatch.id)}>
                <TriangleAlert size={13} aria-hidden="true" /> Incident
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const allDispatches = dispatchQuery.data ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const dispatches = allDispatches.filter((dispatch) => {
    const matchesTerm = !term ||
      `${dispatch.publicId ?? ''} ${dispatch.id} ${dispatch.reservationId} ${dispatch.assignedStaff} ${dispatch.recipientName ?? ''}`
        .toLowerCase()
        .includes(term);
    return matchesTerm && (!status || dispatch.status.toUpperCase() === status);
  });

  const confirmedReservations = (reservationsQuery.data ?? []).filter(
    (reservation) => reservation.status.toUpperCase() === 'CONFIRMED',
  );

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Dispatch"
        description="Move confirmed reservations through departure, delivery, and incident reporting."
        actions={
          auth.hasPermission(PERMISSIONS.DISPATCH_CREATE) ? (
            <button type="button" className="btn btn-primary" onClick={() => openDialog('create')}>
              <Plus size={16} aria-hidden="true" /> New dispatch
            </button>
          ) : undefined
        }
      />

      <DataTable
        ariaLabel="Dispatch list"
        rowKey={(row) => row.id}
        columns={columns}
        rows={dispatches}
        loading={dispatchQuery.isPending}
        emptyTitle="No dispatches"
        emptyDescription="Create a dispatch from a confirmed reservation to see it here."
        toolbar={
          <>
            <div className="search-input-wrap">
              <Search size={15} aria-hidden="true" />
              <input className="input" type="search" aria-label="Search dispatches" placeholder="Search dispatches…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <label className="sr-only" htmlFor="dispatch-status">Dispatch status</label>
            <select id="dispatch-status" className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {DISPATCH_STATUSES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </select>
          </>
        }
      />
      {dispatchQuery.isError && (
        <div className="card" style={{ marginTop: 16 }}><ErrorState error={dispatchQuery.error} onRetry={() => void dispatchQuery.refetch()} /></div>
      )}

      <Modal
        open={dialog === 'create'}
        onClose={() => setDialog(null)}
        title="Create dispatch"
        description="Select a confirmed reservation and record the assigned staff member."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={mutation.isPending} onClick={submitDialog}>Create dispatch</button>
          </>
        }
      >
        <div className="form-grid">
          <FormField label="Confirmed reservation" error={errors.reservationId} required full>
            <select className="select" value={reservationId} onChange={(event) => setReservationId(event.target.value)}>
              <option value="">Select a reservation…</option>
              {confirmedReservations.map((reservation) => (
                <option key={reservation.id} value={reservation.id}>
                  {reservation.publicId ?? `RES-${reservation.id}`} · unit #{reservation.unitId}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Assigned staff" error={errors.assignedStaff} required full>
            <input className="input" value={assignedStaff} onChange={(event) => setAssignedStaff(event.target.value)} />
          </FormField>
        </div>
        {reservationsQuery.isError && <p className="field-error" style={{ marginTop: 8 }}>Reservations unavailable: {getErrorMessage(reservationsQuery.error)}</p>}
        {reservationsQuery.isSuccess && confirmedReservations.length === 0 && (
          <p className="text-sm text-muted" style={{ marginTop: 12 }}>No confirmed reservations are currently available.</p>
        )}
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          <KeyRound size={17} aria-hidden="true" />
          <span>Idempotency key: <strong className="mono">{idempotencyKey}</strong></span>
        </div>
      </Modal>

      <Modal
        open={dialog === 'deliver'}
        onClose={() => setDialog(null)}
        title="Record delivery"
        description="Identify who received the dispatch."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={mutation.isPending} onClick={submitDialog}>Record delivery</button>
          </>
        }
      >
        <FormField label="Recipient name" error={errors.recipientName} required full>
          <input className="input" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
        </FormField>
      </Modal>

      <Modal
        open={dialog === 'incident'}
        onClose={() => setDialog(null)}
        title="Report incident"
        description="Describe what happened. The report is attached to this dispatch."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={mutation.isPending} onClick={submitDialog}>Report incident</button>
          </>
        }
      >
        <FormField label="Description" error={errors.incident} required full>
          <textarea className="textarea" value={incident} onChange={(event) => setIncident(event.target.value)} />
        </FormField>
      </Modal>
    </>
  );
}
