import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Ambulance,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DISPATCH_STATUSES } from '@/lib/constants';
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
  DispatchView,
  EmergencyRequestDetail,
  EmergencyRequestView,
  OrganizationView,
  ReservationView,
} from '@/types/domain';

type DialogKind = 'create' | 'depart' | 'deliver' | 'incident' | null;
type DispatchSortKey = 'id' | 'status' | 'assignedStaff' | 'dispatchedAt' | 'deliveredAt';

function formatFreshness(updatedAt: number, now: number): string {
  if (!updatedAt) return 'awaiting first sync';
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 15) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function DispatchPage() {
  const auth = useAuth();
  const toast = useToast();
  const invalidateDomains = useInvalidateDomains();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'dispatchedAt', direction: 'desc' });
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [manualReservation, setManualReservation] = useState(false);
  const [reservationId, setReservationId] = useState('');
  const [assignedStaff, setAssignedStaff] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [incident, setIncident] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const dispatchQuery = useQuery({
    queryKey: ['dispatches', 'list'],
    queryFn: () => api.get<DispatchView[]>('/dispatches'),
  });

  const detailQuery = useQuery({
    queryKey: ['dispatches', 'detail', selectedId],
    queryFn: () => api.get<DispatchView>(`/dispatches/${selectedId}`),
    enabled: selectedId !== null,
  });

  const reservationsQuery = useQuery({
    queryKey: ['reservations', 'list'],
    queryFn: () => api.get<ReservationView[]>('/reservations'),
    enabled: auth.hasPermission(PERMISSIONS.RESERVATION_READ) || dialog === 'create',
  });

  const requestsQuery = useQuery({
    queryKey: ['requests', 'list', ''],
    queryFn: () => api.get<EmergencyRequestView[]>('/emergency-requests'),
    enabled: auth.hasPermission(PERMISSIONS.REQUEST_READ),
  });

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'names'],
    queryFn: () => api.get<PageResponse<OrganizationView>>('/organizations', { query: { size: 100 } }),
    enabled: auth.hasPermission(PERMISSIONS.ORGANIZATION_READ),
  });

  const detail = detailQuery.data;

  const reservationDetailQuery = useQuery({
    queryKey: ['reservations', 'detail', detail?.reservationId],
    queryFn: () => api.get<ReservationView>(`/reservations/${detail?.reservationId}`),
    enabled: detail !== undefined && auth.hasPermission(PERMISSIONS.RESERVATION_READ),
  });

  const requestDetailQuery = useQuery({
    queryKey: ['requests', 'detail', detail?.requestId],
    queryFn: () => api.get<EmergencyRequestDetail>(`/emergency-requests/${detail?.requestId}`),
    enabled: detail !== undefined && auth.hasPermission(PERMISSIONS.REQUEST_READ),
  });

  const invalidate = () => {
    invalidateDomains(['dispatches', 'reservations', 'requests', 'inventory']);
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
    onError: (error) => {
      toast.error('Action failed', getErrorMessage(error));
      if (dialog === 'create') setIdempotencyKey(api.createIdempotencyKey());
    },
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
      mutation.mutate({ id: activeId, kind: dialog as 'create' | 'depart' | 'deliver' | 'incident' });
    }
  };

  const openDialog = (kind: Exclude<DialogKind, null>, id: number | null = null) => {
    setSelectedId(null); // dialogs must not be nested inside the detail drawer
    setDialog(kind);
    setActiveId(id);
    setErrors({});
    setRecipientName('');
    setIncident('');
    if (kind === 'create') {
      setIdempotencyKey(api.createIdempotencyKey());
      setReservationId('');
      setAssignedStaff('');
      setManualReservation(false);
    }
  };

  const requestsMap = useMemo(
    () => new Map((requestsQuery.data ?? []).map((item) => [item.id, item])),
    [requestsQuery.data],
  );

  const reservationsMap = useMemo(
    () => new Map((reservationsQuery.data ?? []).map((item) => [item.id, item])),
    [reservationsQuery.data],
  );

  const organizationsMap = useMemo(
    () => new Map((organizationsQuery.data?.content ?? []).map((item) => [item.id, item])),
    [organizationsQuery.data],
  );

  const organizationName = (id?: number | null): string => {
    if (!id) return '—';
    return (
      organizationsMap.get(id)?.name ??
      auth.user?.memberships.find((item) => item.organizationId === id)?.organizationName ??
      `Organization #${id}`
    );
  };

  const allDispatches = dispatchQuery.data ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const dispatches = useMemo(() => {
    const filtered = allDispatches.filter((dispatch) => {
      const matchesTerm =
        !term ||
        `${dispatch.publicId ?? ''} ${dispatch.id} ${dispatch.reservationId} ${dispatch.requestId} ${dispatch.assignedStaff} ${dispatch.recipientName ?? ''}`
          .toLowerCase()
          .includes(term);
      const matchesOrg = !organizationFilter ||
        String(dispatch.organizationId) === organizationFilter ||
        String(requestsMap.get(dispatch.requestId)?.organizationId ?? '') === organizationFilter;
      return matchesTerm && (!status || dispatch.status.toUpperCase() === status) && matchesOrg;
    });
    return [...filtered].sort((a, b) => {
      let result = 0;
      switch (sort.key as DispatchSortKey) {
        case 'status':
          result = a.status.localeCompare(b.status);
          break;
        case 'assignedStaff':
          result = a.assignedStaff.localeCompare(b.assignedStaff);
          break;
        case 'dispatchedAt':
          result = new Date(a.dispatchedAt ?? 0).getTime() - new Date(b.dispatchedAt ?? 0).getTime();
          break;
        case 'deliveredAt':
          result = new Date(a.deliveredAt ?? 0).getTime() - new Date(b.deliveredAt ?? 0).getTime();
          break;
        default:
          result = a.id - b.id;
      }
      return sort.direction === 'asc' ? result : -result;
    });
  }, [allDispatches, organizationFilter, requestsMap, sort, status, term]);

  const organizationOptions = useMemo(() => {
    const ids = new Set<number>();
    allDispatches.forEach((dispatch) => {
      ids.add(dispatch.organizationId);
      const requestOrg = requestsMap.get(dispatch.requestId)?.organizationId;
      if (requestOrg) ids.add(requestOrg);
    });
    return [...ids].map((id) => ({ id, label: organizationName(id) }));
  }, [allDispatches, organizationName, organizationsMap, requestsMap]);

  const columns: DataTableColumn<DispatchView>[] = [
    {
      key: 'id',
      header: 'Dispatch',
      sortable: true,
      render: (dispatch) => (
        <div>
          <div className="table-cell-strong mono">{dispatch.publicId ?? `DSP-${dispatch.id}`}</div>
          <div className="text-xs text-subtle">Reservation #{dispatch.reservationId}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (dispatch) => {
        const isIncident = dispatch.status.toUpperCase() === 'INCIDENT';
        return (
          <div className="cluster">
            <StatusBadge status={dispatch.status} tone={isIncident ? 'danger' : undefined} />
            {isIncident && <span className="status-chip">Follow-up required</span>}
          </div>
        );
      },
    },
    {
      key: 'assignedStaff',
      header: 'Assigned staff',
      sortable: true,
      render: (dispatch) => dispatch.assignedStaff,
    },
    {
      key: 'supplier',
      header: 'Supplier org',
      render: (dispatch) => organizationName(dispatch.organizationId),
    },
    {
      key: 'requesting',
      header: 'Requesting org',
      render: (dispatch) => {
        const request = requestsMap.get(dispatch.requestId);
        return request?.organizationName ?? organizationName(request?.organizationId);
      },
    },
    {
      key: 'dispatchedAt',
      header: 'Departed',
      sortable: true,
      render: (dispatch) => formatDateTime(dispatch.dispatchedAt),
    },
    {
      key: 'deliveredAt',
      header: 'Delivered',
      sortable: true,
      render: (dispatch) => formatDateTime(dispatch.deliveredAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (dispatch) => {
        if (!auth.hasPermission(PERMISSIONS.DISPATCH_MANAGE)) {
          return <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(dispatch.id)}>Details</button>;
        }
        const currentStatus = dispatch.status.toUpperCase();
        return (
          <div className="table-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(dispatch.id)}>
              Details
            </button>
            {currentStatus === 'PREPARING' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={mutation.isPending}
                onClick={() => openDialog('depart', dispatch.id)}
              >
                <Ambulance size={13} aria-hidden="true" /> Depart
              </button>
            )}
            {['IN_TRANSIT', 'INCIDENT'].includes(currentStatus) && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openDialog('deliver', dispatch.id)}>
                Deliver
              </button>
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

  const handleSort = (key: string) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  const inProgressCount = allDispatches.filter((item) =>
    ['PREPARING', 'IN_TRANSIT'].includes(item.status.toUpperCase()),
  ).length;
  const incidentCount = allDispatches.filter((item) => item.status.toUpperCase() === 'INCIDENT').length;
  const deliveredCount = allDispatches.filter((item) => item.status.toUpperCase() === 'DELIVERED').length;
  const confirmedReservations = (reservationsQuery.data ?? []).filter(
    (reservation) => reservation.status.toUpperCase() === 'CONFIRMED',
  );

  const lifecycle: Array<{ key: string; title: string; at?: string; note?: string }> = [];
  if (detail) {
    const confirmedAt = reservationDetailQuery.data?.confirmedAt;
    if (confirmedAt) {
      lifecycle.push({
        key: 'reserved',
        title: 'Reservation confirmed',
        at: confirmedAt,
        note: `Unit ${reservationDetailQuery.data?.unitNumber}`,
      });
    }
    if (detail.dispatchedAt) {
      lifecycle.push({
        key: 'departed',
        title: 'Departed',
        at: detail.dispatchedAt,
        note: `Staff: ${detail.assignedStaff}`,
      });
    }
    if (detail.incidentDescription) {
      lifecycle.push({ key: 'incident', title: 'Incident reported', note: detail.incidentDescription });
    }
    if (detail.deliveredAt) {
      lifecycle.push({
        key: 'delivered',
        title: 'Delivered',
        at: detail.deliveredAt,
        note: detail.recipientName ? `Received by ${detail.recipientName}` : undefined,
      });
    }
  }

  const requestEvents = requestDetailQuery.data?.events ?? [];
  const activeIncident = dialog === 'incident' && activeId !== null
    ? allDispatches.find((item) => item.id === activeId)?.incidentDescription
    : undefined;
  const detailActiveIncident = detail?.incidentDescription;

  return (
    <div className="app-page page-enter">
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

      <Grid columns="stats">
        <StatCard label="In progress" value={inProgressCount} hint="Preparing and in transit" />
        <StatCard label="Incidents" value={incidentCount} hint="Awaiting follow-up" />
        <StatCard label="Delivered" value={deliveredCount} hint="Completed handovers" />
      </Grid>

      <div style={{ marginTop: 18 }}>
        <DataTable
          ariaLabel="Dispatch list"
          rowKey={(row) => row.id}
          columns={columns}
          rows={dispatches}
          loading={dispatchQuery.isPending}
          sort={sort}
          onSort={handleSort}
          onRowClick={(dispatch) => setSelectedId(dispatch.id)}
          emptyTitle="No dispatches"
          emptyDescription="Create a dispatch from a confirmed reservation to see it here."
          toolbar={
            <div className="toolbar">
              <div className="toolbar-search">
                <Search size={15} aria-hidden="true" />
                <Input
                  type="search"
                  aria-label="Search dispatches"
                  placeholder="Search dispatches…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="filter-grid">
                <div className="filter-field">
                  <label className="sr-only" htmlFor="dispatch-status">Dispatch status</label>
                  <Select
                    id="dispatch-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {DISPATCH_STATUSES.map((item) => (
                      <option key={item} value={item}>{humanize(item)}</option>
                    ))}
                  </Select>
                </div>
                <div className="filter-field">
                  <label className="sr-only" htmlFor="dispatch-organization">Organization</label>
                  <Select
                    id="dispatch-organization"
                    value={organizationFilter}
                    onChange={(event) => setOrganizationFilter(event.target.value)}
                  >
                    <option value="">All organizations</option>
                    {organizationOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <span className="freshness" aria-live="polite">
                <span className="live-dot" aria-hidden="true" />
                Updated {formatFreshness(dispatchQuery.dataUpdatedAt, now)}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={dispatchQuery.isFetching}
                onClick={() => void dispatchQuery.refetch()}
              >
                <RefreshCw size={14} aria-hidden="true" /> Refresh
              </button>
            </div>
          }
        />
      </div>
      {dispatchQuery.isError && (
        <Surface padding="md" style={{ marginTop: 16 }}>
          <ErrorState error={dispatchQuery.error} onRetry={() => void dispatchQuery.refetch()} />
        </Surface>
      )}

      <div className="task-grid" style={{ marginTop: 18 }}>
        <button
          type="button"
          className="task-card surface-interactive"
          onClick={() => setStatus('IN_TRANSIT')}
        >
          <span className="task-icon"><Ambulance size={18} aria-hidden="true" /></span>
          <span className="task-title">In transit</span>
          <span className="task-meta">{allDispatches.filter((item) => item.status.toUpperCase() === 'IN_TRANSIT').length} dispatches</span>
          <span className="task-cta">Filter list →</span>
        </button>
        <button
          type="button"
          className="task-card surface-interactive"
          onClick={() => setStatus('INCIDENT')}
        >
          <span className="task-icon"><TriangleAlert size={18} aria-hidden="true" /></span>
          <span className="task-title">Incidents to review</span>
          <span className="task-meta">{incidentCount} reported</span>
          <span className="task-cta">Filter list →</span>
        </button>
        <button
          type="button"
          className="task-card surface-interactive"
          onClick={() => setStatus('DELIVERED')}
        >
          <span className="task-icon"><CheckCircle2 size={18} aria-hidden="true" /></span>
          <span className="task-title">Delivered</span>
          <span className="task-meta">{deliveredCount} completed</span>
          <span className="task-cta">Filter list →</span>
        </button>
      </div>

      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail ? `Dispatch ${detail.publicId ?? `#${detail.id}`}` : 'Dispatch detail'}
        description={detail ? `${humanize(detail.status)} · ${detail.assignedStaff}` : undefined}
      >
        {detailQuery.isPending && <div className="skeleton-lines"><Skeleton height={18} /><Skeleton height={18} /></div>}
        {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />}
        {detail && (
          <>
            <div className="live-pill" style={{ marginBottom: 14 }}>
              <span className="live-dot" aria-hidden="true" />
              {humanize(detail.status)} · updated {formatFreshness(detailQuery.dataUpdatedAt, now)}
            </div>
            <dl className="detail-grid">
              <div className="detail-item"><dt>Status</dt><dd><StatusBadge status={detail.status} tone={detail.status.toUpperCase() === 'INCIDENT' ? 'danger' : undefined} /></dd></div>
              <div className="detail-item"><dt>Assigned staff</dt><dd>{detail.assignedStaff}</dd></div>
              <div className="detail-item"><dt>Reservation</dt><dd className="mono">#{detail.reservationId}</dd></div>
              <div className="detail-item"><dt>Request</dt><dd className="mono">#{detail.requestId}</dd></div>
              <div className="detail-item"><dt>Supplier organization</dt><dd>{organizationName(reservationDetailQuery.data?.organizationId ?? detail.organizationId)}</dd></div>
              <div className="detail-item">
                <dt>Requesting organization</dt>
                <dd>
                  {requestsMap.get(detail.requestId)?.organizationName ??
                    requestDetailQuery.data?.request.organizationName ??
                    organizationName(requestDetailQuery.data?.request.organizationId)}
                </dd>
              </div>
              <div className="detail-item"><dt>Departed</dt><dd>{formatDateTime(detail.dispatchedAt)}</dd></div>
              <div className="detail-item"><dt>Delivered</dt><dd>{formatDateTime(detail.deliveredAt)}</dd></div>
              <div className="detail-item"><dt>Recipient</dt><dd>{detail.recipientName ?? '—'}</dd></div>
              <div className="detail-item"><dt>Unit</dt><dd>{reservationDetailQuery.data?.unitNumber ?? `#${reservationsMap.get(detail.reservationId)?.unitId ?? '—'}`}</dd></div>
            </dl>

            {detailActiveIncident && (
              <div className="alert alert-warning" role="note" style={{ marginTop: 16 }}>
                <TriangleAlert size={17} aria-hidden="true" />
                <span>
                  <strong>Incident follow-up required.</strong> {detailActiveIncident} Record delivery after the incident
                  has been reviewed; the server gates state transitions.
                </span>
              </div>
            )}

            <div className="section-heading" style={{ marginTop: 18 }}>
              <h3>Dispatch timeline</h3>
              <span className="status-chip">{lifecycle.length + requestEvents.length} entries</span>
            </div>
            {lifecycle.length + requestEvents.length > 0 ? (
              <ol className="timeline-list">
                {lifecycle.map((item) => (
                  <li key={item.key}>
                    <strong>{item.title}</strong>
                    <div className="text-xs text-muted">{item.at ? formatDateTime(item.at) : 'Time not supplied by API'}</div>
                    {item.note && <p className="text-sm">{item.note}</p>}
                  </li>
                ))}
                {requestEvents.map((event) => (
                  <li key={`request-${event.id}`}>
                    <strong>{humanize(event.action)}</strong>
                    <div className="text-xs text-muted">{formatDateTime(event.occurredAt)}</div>
                    {event.notes && <p className="text-sm">{event.notes}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No timeline entries are available for this dispatch yet.</p>
            )}
            {requestDetailQuery.isError && (
              <p className="field-error">Request timeline unavailable: {getErrorMessage(requestDetailQuery.error)}</p>
            )}

            <div className="form-actions" style={{ marginTop: 18 }}>
              {auth.hasPermission(PERMISSIONS.RESERVATION_READ) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedId(null);
                    navigate(`/app/reservations?reservationId=${detail.reservationId}`);
                  }}
                >
                  <ExternalLink size={14} aria-hidden="true" /> Open reservation
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.REQUEST_READ) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedId(null);
                    navigate(`/app/requests?requestId=${detail.requestId}`);
                  }}
                >
                  <ExternalLink size={14} aria-hidden="true" /> Open request
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.DISPATCH_MANAGE) && detail.status.toUpperCase() === 'PREPARING' && (
                <button type="button" className="btn btn-primary" onClick={() => openDialog('depart', detail.id)}>
                  <Ambulance size={14} aria-hidden="true" /> Depart
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.DISPATCH_MANAGE) && ['IN_TRANSIT', 'INCIDENT'].includes(detail.status.toUpperCase()) && (
                <button type="button" className="btn btn-primary" onClick={() => openDialog('deliver', detail.id)}>
                  Record delivery <ArrowRight size={14} aria-hidden="true" />
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.DISPATCH_MANAGE) && detail.status.toUpperCase() !== 'DELIVERED' && (
                <button type="button" className="btn btn-danger" onClick={() => openDialog('incident', detail.id)}>
                  {detailActiveIncident ? 'Update incident' : 'Report incident'}
                </button>
              )}
            </div>
          </>
        )}
      </Drawer>

      <Modal
        open={dialog === 'create'}
        onClose={() => setDialog(null)}
        title="Create dispatch"
        description="Select a confirmed reservation and record the assigned staff member."
        footer={
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={mutation.isPending} onClick={submitDialog}>
              Create dispatch
            </button>
          </div>
        }
      >
        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setManualReservation((current) => !current)}>
            {manualReservation ? 'Choose from API lists' : 'Enter ID manually'}
          </button>
        </div>
        <div className="form-grid">
          <FormField label="Confirmed reservation" error={errors.reservationId} required full>
            {!manualReservation && confirmedReservations.length > 0 ? (
              <select
                className="select"
                value={reservationId}
                onChange={(event) => setReservationId(event.target.value)}
              >
                <option value="">Select a reservation…</option>
                {confirmedReservations.map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    {reservation.publicId ?? `RES-${reservation.id}`} · unit {reservation.unitNumber} · request #{reservation.requestId}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                inputMode="numeric"
                placeholder="Reservation ID"
                value={reservationId}
                onChange={(event) => setReservationId(event.target.value)}
              />
            )}
          </FormField>
          <FormField label="Assigned staff" error={errors.assignedStaff} required full>
            <input
              className="input"
              value={assignedStaff}
              onChange={(event) => setAssignedStaff(event.target.value)}
            />
          </FormField>
        </div>
        {reservationsQuery.isError && (
          <p className="field-error">Reservations unavailable: {getErrorMessage(reservationsQuery.error)}. Enter the ID manually.</p>
        )}
        {reservationsQuery.isSuccess && confirmedReservations.length === 0 && !manualReservation && (
          <p className="text-sm text-muted" style={{ marginTop: 12 }}>No confirmed reservations are currently available.</p>
        )}
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
      </Modal>

      <Modal
        open={dialog === 'depart'}
        onClose={() => setDialog(null)}
        title="Confirm departure"
        description="The dispatch will be marked in transit through the API."
        footer={
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Stay in preparation</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={mutation.isPending}
              onClick={submitDialog}
            >
              Confirm departure
            </button>
          </div>
        }
      >
        {activeId !== null && (
          <dl className="detail-grid">
            <div className="detail-item">
              <dt>Dispatch</dt>
              <dd className="mono">{allDispatches.find((item) => item.id === activeId)?.publicId ?? `#${activeId}`}</dd>
            </div>
            <div className="detail-item">
              <dt>Reservation</dt>
              <dd>#{allDispatches.find((item) => item.id === activeId)?.reservationId ?? '—'}</dd>
            </div>
            <div className="detail-item">
              <dt>Assigned staff</dt>
              <dd>{allDispatches.find((item) => item.id === activeId)?.assignedStaff ?? '—'}</dd>
            </div>
            <div className="detail-item">
              <dt>Supplier organization</dt>
              <dd>{organizationName(allDispatches.find((item) => item.id === activeId)?.organizationId)}</dd>
            </div>
          </dl>
        )}
        <div className="alert alert-warning" role="note" style={{ marginTop: 12 }}>
          <Ambulance size={17} aria-hidden="true" />
          <span>Confirming records the departure time and changes the live status to in transit.</span>
        </div>
      </Modal>

      <Modal
        open={dialog === 'deliver'}
        onClose={() => setDialog(null)}
        title="Record delivery"
        description="Identify who received the dispatch."
        footer={
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={mutation.isPending} onClick={submitDialog}>
              Record delivery
            </button>
          </div>
        }
      >
        <FormField label="Recipient name" error={errors.recipientName} required full>
          <input className="input" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
        </FormField>
      </Modal>

      <Modal
        open={dialog === 'incident'}
        onClose={() => setDialog(null)}
        title={activeIncident ? 'Update incident report' : 'Report incident'}
        description="Describe what happened. The report is attached to this dispatch."
        footer={
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={mutation.isPending} onClick={submitDialog}>
              {activeIncident ? 'Update incident' : 'Report incident'}
            </button>
          </div>
        }
      >
        {activeIncident && (
          <div className="alert alert-warning" role="note">
            <TriangleAlert size={17} aria-hidden="true" />
            <span>
              Current follow-up note: {activeIncident} Submitting again replaces this note and keeps the dispatch in the
              incident state.
            </span>
          </div>
        )}
        <FormField label="Description" error={errors.incident} required full>
          <textarea className="textarea" value={incident} onChange={(event) => setIncident(event.target.value)} />
        </FormField>
        <p className="text-xs text-subtle" style={{ marginTop: 12 }}>
          The dispatch stays flagged for follow-up until delivery is recorded by authorized staff.
        </p>
      </Modal>
    </div>
  );
}
