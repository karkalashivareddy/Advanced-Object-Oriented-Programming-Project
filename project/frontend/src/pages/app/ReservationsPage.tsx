import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  TicketCheck,
  XCircle,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { RESERVATION_STATUSES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { useInvalidateDomains } from '@/lib/queryCache';
import { formatDateTime, humanize } from '@/lib/utils';
import {
  DataTable,
  Drawer,
  ErrorState,
  FormField,
  Grid,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
  Surface,
  useToast,
  type DataTableColumn,
  type SortState,
} from '@/components/ui';
import type { PageResponse } from '@/types/api';
import type {
  BloodUnitView,
  EmergencyRequestDetail,
  EmergencyRequestView,
  ReservationView,
} from '@/types/domain';

interface CreateForm {
  unitId: string;
  requestId: string;
}

type ReservationSortKey = 'id' | 'unitNumber' | 'status' | 'expiresAt' | 'confirmedAt';

const EMPTY_FORM: CreateForm = { unitId: '', requestId: '' };

function formatFreshness(updatedAt: number, now: number): string {
  if (!updatedAt) return 'awaiting first sync';
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 15) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function countdown(expiresAt: string, now: number): { label: string; urgent: boolean; expired: boolean } {
  if (!expiresAt) return { label: 'No expiry', urgent: false, expired: false };
  const remaining = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(remaining)) return { label: 'Unknown', urgent: false, expired: false };
  if (remaining <= 0) return { label: 'Expired', urgent: true, expired: true };
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const label = minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m left`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s left`;
  return { label, urgent: remaining < 10 * 60_000, expired: false };
}

export function ReservationsPage() {
  const auth = useAuth();
  const toast = useToast();
  const invalidateDomains = useInvalidateDomains();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [requestFilter, setRequestFilter] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'expiresAt', direction: 'asc' });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ReservationView | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [manualIds, setManualIds] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const deepLinkedId = searchParams.get('reservationId');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (deepLinkedId && /^\d+$/.test(deepLinkedId)) setSelectedId(Number(deepLinkedId));
  }, [deepLinkedId]);

  const closeDetail = () => {
    setSelectedId(null);
    if (searchParams.has('reservationId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('reservationId');
      setSearchParams(next, { replace: true });
    }
  };

  // The list endpoint returns every reservation visible to the caller; filters
  // and sorting below operate on those server records without guessing data.
  const reservationsQuery = useQuery({
    queryKey: ['reservations', 'list'],
    queryFn: () => api.get<ReservationView[]>('/reservations'),
  });

  const detailQuery = useQuery({
    queryKey: ['reservations', 'detail', selectedId],
    queryFn: () => api.get<ReservationView>(`/reservations/${selectedId}`),
    enabled: selectedId !== null,
  });

  const detail = detailQuery.data;

  const unitQuery = useQuery({
    queryKey: ['inventory', 'detail', detail?.unitId],
    queryFn: () => api.get<BloodUnitView>(`/inventory/${detail?.unitId}`),
    enabled: detail !== undefined && auth.hasPermission(PERMISSIONS.INVENTORY_READ),
  });

  const requestQuery = useQuery({
    queryKey: ['requests', 'detail', detail?.requestId],
    queryFn: () => api.get<EmergencyRequestDetail>(`/emergency-requests/${detail?.requestId}`),
    enabled: detail !== undefined && auth.hasPermission(PERMISSIONS.REQUEST_READ),
  });

  const unitOptionsQuery = useQuery({
    queryKey: ['inventory', 'picker', 'available'],
    queryFn: () => api.get<PageResponse<BloodUnitView>>('/inventory', {
      query: { status: 'AVAILABLE', size: 50, sort: 'expiresAt,asc' },
    }),
    enabled: createOpen && auth.hasPermission(PERMISSIONS.INVENTORY_READ),
  });

  // The request API supports a single status filter per call, so use two real
  // server-filtered queries for the states that may be reserved.
  const approvedRequestsQuery = useQuery({
    queryKey: ['requests', 'list', 'APPROVED'],
    queryFn: () => api.get<EmergencyRequestView[]>('/emergency-requests', { query: { status: 'APPROVED' } }),
    enabled: createOpen && auth.hasPermission(PERMISSIONS.REQUEST_READ),
  });

  const allocatingRequestsQuery = useQuery({
    queryKey: ['requests', 'list', 'ALLOCATING'],
    queryFn: () => api.get<EmergencyRequestView[]>('/emergency-requests', { query: { status: 'ALLOCATING' } }),
    enabled: createOpen && auth.hasPermission(PERMISSIONS.REQUEST_READ),
  });

  const invalidate = () => {
    invalidateDomains(['reservations', 'inventory', 'requests', 'dispatches']);
  };

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: 'confirm' | 'cancel' }) =>
      api.post(`/reservations/${id}/${kind}`),
    onSuccess: (_, variables) => {
      toast.success(`Reservation ${variables.kind === 'confirm' ? 'confirmed' : 'cancelled'}`);
      setCancelTarget(null);
      invalidate();
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
    onError: (error) => {
      toast.error('Could not create reservation', getErrorMessage(error));
      setIdempotencyKey(api.createIdempotencyKey());
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!/^\d+$/.test(form.unitId)) next.unitId = 'Choose an available unit.';
    if (!/^\d+$/.test(form.requestId)) next.requestId = 'Choose an approved request.';
    if (!idempotencyKey) next.idempotencyKey = 'An idempotency key is required.';
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  };

  const canCancel = (reservation: ReservationView) => {
    const ownsReservation =
      auth.organizationId === reservation.organizationId ||
      (auth.user?.memberships.some((item) => item.organizationId === reservation.organizationId) ?? false);
    return auth.hasRole('PLATFORM_ADMIN') || (ownsReservation && auth.hasPermission(PERMISSIONS.RESERVATION_CREATE));
  };

  const openCancel = (reservation: ReservationView) => {
    closeDetail(); // never stack the confirmation modal over the drawer
    setCancelTarget(reservation);
  };

  const openCreate = () => {
    setIdempotencyKey(api.createIdempotencyKey());
    setForm(EMPTY_FORM);
    setManualIds(false);
    setErrors({});
    setCreateOpen(true);
  };

  const allReservations = reservationsQuery.data ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const reservations = useMemo(() => {
    const filtered = allReservations.filter((reservation) => {
      const matchesTerm =
        !term ||
        `${reservation.publicId ?? ''} ${reservation.unitNumber ?? ''} ${reservation.id} ${reservation.unitId} ${reservation.requestId}`
          .toLowerCase()
          .includes(term);
      const matchesUnit = !/^\d+$/.test(unitFilter) || reservation.unitId === Number(unitFilter);
      const matchesRequest = !/^\d+$/.test(requestFilter) || reservation.requestId === Number(requestFilter);
      const matchesOrg = !organizationFilter || String(reservation.organizationId) === organizationFilter;
      return matchesTerm && (!status || reservation.status.toUpperCase() === status) && matchesUnit && matchesRequest && matchesOrg;
    });
    return [...filtered].sort((a, b) => {
      let result = 0;
      switch (sort.key as ReservationSortKey) {
        case 'unitNumber':
          result = (a.unitNumber ?? '').localeCompare(b.unitNumber ?? '');
          break;
        case 'status':
          result = a.status.localeCompare(b.status);
          break;
        case 'expiresAt':
          result = new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
          break;
        case 'confirmedAt':
          result = new Date(a.confirmedAt ?? 0).getTime() - new Date(b.confirmedAt ?? 0).getTime();
          break;
        default:
          result = a.id - b.id;
      }
      return sort.direction === 'asc' ? result : -result;
    });
  }, [allReservations, organizationFilter, requestFilter, sort, status, term, unitFilter]);

  const organizationOptions = useMemo(() => {
    const ids = new Set<number>(allReservations.map((item) => item.organizationId));
    auth.user?.memberships.forEach((item) => ids.add(item.organizationId));
    return [...ids].map((id) => ({
      id,
      label: auth.user?.memberships.find((item) => item.organizationId === id)?.organizationName ?? `Organization #${id}`,
    }));
  }, [allReservations, auth.user]);

  const activeCount = allReservations.filter((item) => item.status.toUpperCase() === 'ACTIVE').length;
  const urgentCount = allReservations.filter((item) => {
    const state = countdown(item.expiresAt, now);
    return !state.expired && state.urgent && ['ACTIVE', 'CONFIRMED'].includes(item.status.toUpperCase());
  }).length;
  const confirmedCount = allReservations.filter((item) => item.status.toUpperCase() === 'CONFIRMED').length;

  const availableUnits = unitOptionsQuery.data?.content ?? [];
  const selectableRequests = useMemo(
    () => [...(approvedRequestsQuery.data ?? []), ...(allocatingRequestsQuery.data ?? [])],
    [approvedRequestsQuery.data, allocatingRequestsQuery.data],
  );

  const handleSort = (key: string) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  const columns: DataTableColumn<ReservationView>[] = [
    {
      key: 'id',
      header: 'Reservation',
      sortable: true,
      render: (reservation) => (
        <div>
          <div className="table-cell-strong mono">{reservation.publicId ?? `RES-${reservation.id}`}</div>
          <div className="text-xs text-subtle">Request #{reservation.requestId}</div>
        </div>
      ),
    },
    {
      key: 'unitNumber',
      header: 'Unit',
      sortable: true,
      render: (reservation) => reservation.unitNumber ?? `#${reservation.unitId}`,
    },
    { key: 'status', header: 'Status', sortable: true, render: (reservation) => <StatusBadge status={reservation.status} /> },
    {
      key: 'expiresAt',
      header: 'Expires',
      sortable: true,
      render: (reservation) => {
        const state = countdown(reservation.expiresAt, now);
        return (
          <div>
            <span
              className="status-chip"
              style={{
                color: state.urgent ? 'var(--color-danger, #b42318)' : undefined,
                fontWeight: state.urgent ? 700 : undefined,
              }}
            >
              <span className="live-dot" aria-hidden="true" /> {state.label}
            </span>
            <div className="text-xs text-subtle">{formatDateTime(reservation.expiresAt)}</div>
          </div>
        );
      },
    },
    {
      key: 'confirmedAt',
      header: 'Confirmed',
      sortable: true,
      render: (reservation) => formatDateTime(reservation.confirmedAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (reservation) => {
        const currentStatus = reservation.status.toUpperCase();
        return (
          <div className="table-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(reservation.id)}>
              Details
            </button>
            {auth.hasPermission(PERMISSIONS.RESERVATION_CONFIRM) && currentStatus === 'ACTIVE' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={action.isPending}
                onClick={() => action.mutate({ id: reservation.id, kind: 'confirm' })}
              >
                <CheckCircle2 size={13} aria-hidden="true" /> Confirm
              </button>
            )}
            {['ACTIVE', 'CONFIRMED'].includes(currentStatus) && canCancel(reservation) && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => openCancel(reservation)}>
                <XCircle size={13} aria-hidden="true" /> Cancel
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="app-page page-enter">
      <PageHeader
        eyebrow="Operations"
        title="Reservations"
        description="Time-bound holds on blood units, created with an idempotency key."
        actions={
          auth.hasPermission(PERMISSIONS.RESERVATION_CREATE) ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} aria-hidden="true" /> New reservation
            </button>
          ) : undefined
        }
      />

      <Grid columns="stats">
        <StatCard label="Active holds" value={activeCount} hint={`${allReservations.length} total in view`} />
        <StatCard label="Expiring within 10 min" value={urgentCount} hint="Live countdown" />
        <StatCard label="Confirmed" value={confirmedCount} hint="Ready for dispatch" />
      </Grid>

      <div style={{ marginTop: 18 }}>
        <DataTable
          ariaLabel="Reservation list"
          rowKey={(row) => row.id}
          columns={columns}
          rows={reservations}
          loading={reservationsQuery.isPending}
          sort={sort}
          onSort={handleSort}
          onRowClick={(reservation) => setSelectedId(reservation.id)}
          emptyTitle="No reservations"
          emptyDescription="Confirmed allocations and manual reservations appear here."
          toolbar={
            <div className="toolbar">
              <div className="toolbar-search">
                <Search size={15} aria-hidden="true" />
                <Input
                  type="search"
                  aria-label="Search reservations"
                  placeholder="Search reservations…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="filter-grid">
                <div className="filter-field">
                  <label className="sr-only" htmlFor="reservation-status">Reservation status</label>
                  <Select
                    id="reservation-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {RESERVATION_STATUSES.map((item) => (
                      <option key={item} value={item}>{humanize(item)}</option>
                    ))}
                  </Select>
                </div>
                <div className="filter-field">
                  <label className="sr-only" htmlFor="reservation-organization">Organization</label>
                  <Select
                    id="reservation-organization"
                    value={organizationFilter}
                    onChange={(event) => setOrganizationFilter(event.target.value)}
                  >
                    <option value="">All organizations</option>
                    {organizationOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="filter-field">
                  <label className="sr-only" htmlFor="reservation-unit-filter">Unit ID</label>
                  <Input
                    id="reservation-unit-filter"
                    inputMode="numeric"
                    placeholder="Unit ID"
                    value={unitFilter}
                    onChange={(event) => setUnitFilter(event.target.value)}
                  />
                </div>
                <div className="filter-field">
                  <label className="sr-only" htmlFor="reservation-request-filter">Request ID</label>
                  <Input
                    id="reservation-request-filter"
                    inputMode="numeric"
                    placeholder="Request ID"
                    value={requestFilter}
                    onChange={(event) => setRequestFilter(event.target.value)}
                  />
                </div>
              </div>
              <span className="freshness" aria-live="polite">
                <span className="live-dot" aria-hidden="true" />
                Updated {formatFreshness(reservationsQuery.dataUpdatedAt, now)}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={reservationsQuery.isFetching}
                onClick={() => void reservationsQuery.refetch()}
              >
                <RefreshCw size={14} aria-hidden="true" /> Refresh
              </button>
            </div>
          }
        />
      </div>
      {reservationsQuery.isError && (
        <Surface padding="md" style={{ marginTop: 16 }}>
          <ErrorState error={reservationsQuery.error} onRetry={() => void reservationsQuery.refetch()} />
        </Surface>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={closeDetail}
        title={detail ? `Reservation ${detail.publicId ?? `#${detail.id}`}` : 'Reservation detail'}
        description={detail ? `${humanize(detail.status)} · ${detail.unitNumber}` : undefined}
      >
        {detailQuery.isPending && <div className="skeleton-lines"><Skeleton height={18} /><Skeleton height={18} /></div>}
        {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />}
        {detail && (
          <>
            <div className="live-pill" style={{ marginBottom: 14 }}>
              <span className="live-dot" aria-hidden="true" />
              {countdown(detail.expiresAt, now).label} · updated {formatFreshness(detailQuery.dataUpdatedAt, now)}
            </div>
            <dl className="detail-grid">
              <div className="detail-item"><dt>Status</dt><dd><StatusBadge status={detail.status} /></dd></div>
              <div className="detail-item"><dt>Unit</dt><dd className="mono">{detail.unitNumber}</dd></div>
              <div className="detail-item"><dt>Expires</dt><dd>{formatDateTime(detail.expiresAt)}</dd></div>
              <div className="detail-item"><dt>Confirmed</dt><dd>{formatDateTime(detail.confirmedAt)}</dd></div>
              <div className="detail-item"><dt>Organization</dt><dd>Organization #{detail.organizationId}</dd></div>
              <div className="detail-item"><dt>Request</dt><dd className="mono">#{detail.requestId}</dd></div>
            </dl>

            <div className="section-heading" style={{ marginTop: 18 }}>
              <h3>Linked records</h3>
            </div>
            {unitQuery.data && (
              <dl className="detail-grid">
                <div className="detail-item"><dt>Unit status</dt><dd><StatusBadge status={unitQuery.data.status} /></dd></div>
                <div className="detail-item"><dt>Expires</dt><dd>{formatDateTime(unitQuery.data.expiresAt)}</dd></div>
                <div className="detail-item">
                  <dt>Type</dt>
                  <dd>{humanize(unitQuery.data.bloodGroup)} · {humanize(unitQuery.data.componentType)}</dd>
                </div>
                <div className="detail-item"><dt>Location</dt><dd>{unitQuery.data.storageLocation || '—'}</dd></div>
              </dl>
            )}
            {unitQuery.isError && <p className="field-error">Unit details unavailable: {getErrorMessage(unitQuery.error)}</p>}
            {requestQuery.data && (
              <dl className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-item">
                  <dt>Request</dt>
                  <dd className="mono">{requestQuery.data.request.requestNumber}</dd>
                </div>
                <div className="detail-item"><dt>Urgency</dt><dd><StatusBadge status={requestQuery.data.request.priority} /></dd></div>
                <div className="detail-item"><dt>Quantity</dt><dd>{requestQuery.data.request.quantity}</dd></div>
                <div className="detail-item"><dt>Required by</dt><dd>{formatDateTime(requestQuery.data.request.requiredBy)}</dd></div>
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <dt>Requesting organization</dt>
                  <dd>{requestQuery.data.request.organizationName ?? `Organization #${requestQuery.data.request.organizationId}`}</dd>
                </div>
              </dl>
            )}
            {requestQuery.isError && <p className="field-error">Request details unavailable: {getErrorMessage(requestQuery.error)}</p>}

            <div className="form-actions" style={{ marginTop: 18 }}>
              {auth.hasPermission(PERMISSIONS.INVENTORY_READ) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    closeDetail();
                    navigate(`/app/inventory?unitId=${detail.unitId}`);
                  }}
                >
                  <ExternalLink size={14} aria-hidden="true" /> Open unit
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.REQUEST_READ) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    closeDetail();
                    navigate(`/app/requests?requestId=${detail.requestId}`);
                  }}
                >
                  <ExternalLink size={14} aria-hidden="true" /> Open request
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.ALLOCATION_REVIEW) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    closeDetail();
                    navigate(`/app/allocations?requestId=${detail.requestId}`);
                  }}
                >
                  Review allocations <ArrowRight size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="danger-zone" style={{ marginTop: 18 }}>
              {auth.hasPermission(PERMISSIONS.RESERVATION_CONFIRM) && detail.status.toUpperCase() === 'ACTIVE' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: detail.id, kind: 'confirm' })}
                >
                  <CheckCircle2 size={15} aria-hidden="true" /> Confirm reservation
                </button>
              )}
              {['ACTIVE', 'CONFIRMED'].includes(detail.status.toUpperCase()) && canCancel(detail) && (
                <button type="button" className="btn btn-danger" onClick={() => openCancel(detail)}>
                  <XCircle size={15} aria-hidden="true" /> Cancel reservation
                </button>
              )}
            </div>
          </>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create reservation"
        description="The API sets a 30-minute expiry and requires an approved emergency request."
        footer={
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={create.isPending} onClick={submit}>
              Create reservation
            </button>
          </div>
        }
      >
        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setManualIds((current) => !current)}>
            {manualIds ? 'Choose from API lists' : 'Enter IDs manually'}
          </button>
        </div>
        <div className="form-grid">
          <FormField label="Available unit" error={errors.unitId} required full>
            {!manualIds && availableUnits.length > 0 ? (
              <select
                className="select"
                value={form.unitId}
                onChange={(event) => setForm({ ...form, unitId: event.target.value })}
              >
                <option value="">Select an available unit…</option>
                {availableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitNumber} · {humanize(unit.bloodGroup)} · {humanize(unit.componentType)} · expires {formatDateTime(unit.expiresAt)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                inputMode="numeric"
                placeholder="Unit ID"
                value={form.unitId}
                onChange={(event) => setForm({ ...form, unitId: event.target.value })}
              />
            )}
          </FormField>
          {!manualIds && unitOptionsQuery.isError && (
            <p className="field-error">Unit list unavailable: {getErrorMessage(unitOptionsQuery.error)}. Enter the ID manually.</p>
          )}
          <FormField label="Approved request" error={errors.requestId} hint="Must be approved or allocating" required full>
            {!manualIds && selectableRequests.length > 0 ? (
              <select
                className="select"
                value={form.requestId}
                onChange={(event) => setForm({ ...form, requestId: event.target.value })}
              >
                <option value="">Select a request…</option>
                {selectableRequests.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.requestNumber} · {humanize(item.priority)} · {item.quantity} units · {item.organizationName ?? `Org #${item.organizationId}`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                inputMode="numeric"
                placeholder="Request ID"
                value={form.requestId}
                onChange={(event) => setForm({ ...form, requestId: event.target.value })}
              />
            )}
          </FormField>
          {(approvedRequestsQuery.isError || allocatingRequestsQuery.isError) && (
            <p className="field-error">
              Request list unavailable:{' '}
              {getErrorMessage(approvedRequestsQuery.error ?? allocatingRequestsQuery.error)}. Enter the ID manually.
            </p>
          )}
        </div>
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          <KeyRound size={17} aria-hidden="true" />
          <span>Idempotency key: <strong className="mono">{idempotencyKey}</strong></span>
        </div>
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIdempotencyKey(api.createIdempotencyKey())}
          >
            <RefreshCw size={14} aria-hidden="true" /> Regenerate key
          </button>
          <span className="text-xs text-subtle">A new key is generated automatically after a failed attempt.</span>
        </div>
        <p className="text-xs text-muted" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock3 size={13} aria-hidden="true" /> Holds expire automatically; watch the countdown in the list.
        </p>
      </Modal>

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel reservation"
        description="This releases the held unit through the API."
        footer={
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setCancelTarget(null)}>Keep reservation</button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={action.isPending}
              onClick={() => cancelTarget && action.mutate({ id: cancelTarget.id, kind: 'cancel' })}
            >
              Cancel reservation
            </button>
          </div>
        }
      >
        {cancelTarget && (
          <dl className="detail-grid">
            <div className="detail-item"><dt>Reservation</dt><dd className="mono">{cancelTarget.publicId ?? `#${cancelTarget.id}`}</dd></div>
            <div className="detail-item"><dt>Unit</dt><dd className="mono">{cancelTarget.unitNumber}</dd></div>
            <div className="detail-item"><dt>Request</dt><dd>#{cancelTarget.requestId}</dd></div>
            <div className="detail-item"><dt>Expires</dt><dd>{formatDateTime(cancelTarget.expiresAt)}</dd></div>
          </dl>
        )}
        <div className="alert alert-warning" role="note" style={{ marginTop: 12 }}>
          <TicketCheck size={17} aria-hidden="true" />
          <span>Cancelling requires the reservation-create permission in the owning organization. The server checks permissions again.</span>
        </div>
      </Modal>
    </div>
  );
}
