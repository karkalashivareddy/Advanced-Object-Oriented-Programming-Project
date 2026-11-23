import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Plus, Search, XCircle } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { RESERVATION_STATUSES } from '@/lib/constants';
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
import type { ReservationView } from '@/types/domain';

interface CreateForm {
  unitId: string;
  requestId: string;
}

const EMPTY_FORM: CreateForm = { unitId: '', requestId: '' };

export function ReservationsPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The reservations API returns a list and does not accept search/status/page params.
  const reservationsQuery = useQuery({
    queryKey: ['reservations'],
    queryFn: () => api.get<ReservationView[]>('/reservations'),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['reservations'] });

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: 'confirm' | 'cancel' }) =>
      api.post(`/reservations/${id}/${kind}`),
    onSuccess: (_, variables) => {
      toast.success(`Reservation ${variables.kind === 'confirm' ? 'confirmed' : 'cancelled'}`);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error) => toast.error('Action failed', getErrorMessage(error)),
  });

  const create = useMutation({
    mutationFn: () => api.post<ReservationView>('/reservations', {
      unitId: Number(form.unitId),
      requestId: Number(form.requestId),
      idempotencyKey,
    }, { idempotencyKey }),
    onSuccess: () => {
      toast.success('Reservation created');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setErrors({});
      invalidate();
    },
    onError: (error) => toast.error('Could not create reservation', getErrorMessage(error)),
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!/^\d+$/.test(form.unitId)) next.unitId = 'Enter a numeric unit ID.';
    if (!/^\d+$/.test(form.requestId)) next.requestId = 'Enter a numeric request ID.';
    if (!idempotencyKey) next.idempotencyKey = 'An idempotency key is required.';
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  };

  const allReservations = reservationsQuery.data ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const reservations = allReservations.filter((reservation) => {
    const matchesTerm = !term ||
      `${reservation.publicId ?? ''} ${reservation.unitNumber ?? ''} ${reservation.id} ${reservation.unitId} ${reservation.requestId}`
        .toLowerCase()
        .includes(term);
    return matchesTerm && (!status || reservation.status.toUpperCase() === status);
  });

  const columns: DataTableColumn<ReservationView>[] = [
    {
      key: 'id',
      header: 'Reservation',
      render: (reservation) => (
        <div>
          <div className="table-cell-strong mono">{reservation.publicId ?? `RES-${reservation.id}`}</div>
          <div className="text-xs text-subtle">Unit #{reservation.unitId}</div>
        </div>
      ),
    },
    { key: 'unitNumber', header: 'Unit', render: (reservation) => reservation.unitNumber ?? `#${reservation.unitId}` },
    { key: 'requestId', header: 'Request', render: (reservation) => reservation.requestId },
    { key: 'status', header: 'Status', render: (reservation) => <StatusBadge status={reservation.status} /> },
    { key: 'expiresAt', header: 'Expires', render: (reservation) => formatDateTime(reservation.expiresAt) },
    { key: 'confirmedAt', header: 'Confirmed', render: (reservation) => formatDateTime(reservation.confirmedAt) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (reservation) => {
        const currentStatus = reservation.status.toUpperCase();
        return (
          <div className="table-actions">
            {auth.hasPermission(PERMISSIONS.RESERVATION_CONFIRM) && currentStatus === 'ACTIVE' && (
              <button type="button" className="btn btn-primary btn-sm" disabled={action.isPending} onClick={() => action.mutate({ id: reservation.id, kind: 'confirm' })}>
                <CheckCircle2 size={13} aria-hidden="true" /> Confirm
              </button>
            )}
            {['ACTIVE', 'CONFIRMED'].includes(currentStatus) && (
              <button type="button" className="btn btn-danger btn-sm" disabled={action.isPending} onClick={() => action.mutate({ id: reservation.id, kind: 'cancel' })}>
                <XCircle size={13} aria-hidden="true" /> Cancel
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Reservations"
        description="Time-bound holds on blood units, created with an idempotency key."
        actions={
          auth.hasPermission(PERMISSIONS.RESERVATION_CREATE) ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setIdempotencyKey(api.createIdempotencyKey());
                setCreateOpen(true);
              }}
            >
              <Plus size={16} aria-hidden="true" /> New reservation
            </button>
          ) : undefined
        }
      />

      <DataTable
        ariaLabel="Reservation list"
        rowKey={(row) => row.id}
        columns={columns}
        rows={reservations}
        loading={reservationsQuery.isPending}
        emptyTitle="No reservations"
        emptyDescription="Confirmed allocations and manual reservations appear here."
        toolbar={
          <>
            <div className="search-input-wrap">
              <Search size={15} aria-hidden="true" />
              <input className="input" type="search" aria-label="Search reservations" placeholder="Search reservations…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <label className="sr-only" htmlFor="reservation-status">Reservation status</label>
            <select id="reservation-status" className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {RESERVATION_STATUSES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </select>
          </>
        }
      />
      {reservationsQuery.isError && (
        <div className="card" style={{ marginTop: 16 }}><ErrorState error={reservationsQuery.error} onRetry={() => void reservationsQuery.refetch()} /></div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create reservation"
        description="The API sets a 30-minute expiry and requires an approved emergency request."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={create.isPending} onClick={submit}>Create reservation</button>
          </>
        }
      >
        <div className="form-grid">
          <FormField label="Unit ID" error={errors.unitId} required>
            <input className="input" inputMode="numeric" value={form.unitId} onChange={(event) => setForm({ ...form, unitId: event.target.value })} />
          </FormField>
          <FormField label="Request ID" error={errors.requestId} hint="Must be approved or allocating" required>
            <input className="input" inputMode="numeric" value={form.requestId} onChange={(event) => setForm({ ...form, requestId: event.target.value })} />
          </FormField>
        </div>
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          <KeyRound size={17} aria-hidden="true" />
          <span>Idempotency key: <strong className="mono">{idempotencyKey}</strong></span>
        </div>
      </Modal>
    </>
  );
}
