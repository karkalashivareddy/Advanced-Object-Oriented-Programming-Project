import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  XCircle,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  BLOOD_GROUPS,
  COMPONENT_TYPES,
  PRIORITIES,
  REQUEST_STATUSES,
} from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { useInvalidateDomains } from '@/lib/queryCache';
import { formatDateTime, fromDateTimeLocal, humanize } from '@/lib/utils';
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
  type SortState,
} from '@/components/ui';
import type {
  BloodGroup,
  ComponentType,
  CreateEmergencyRequestRequest,
  EmergencyRequestDetail,
  EmergencyRequestPriority,
  EmergencyRequestView,
} from '@/types/domain';

interface RequestForm {
  organizationId: string;
  patientRef: string;
  bloodGroup: BloodGroup;
  componentType: ComponentType;
  quantity: string;
  priority: EmergencyRequestPriority;
  requiredBy: string;
  reason: string;
}

type RequestAction = 'verify' | 'approve' | 'reject' | 'cancel';
type ReasonKind = 'reject' | 'cancel';
type RequestSortKey = 'requestNumber' | 'priority' | 'status' | 'requiredBy';

const PRIORITY_WEIGHT: Record<EmergencyRequestPriority, number> = {
  ROUTINE: 0,
  URGENT: 1,
  CRITICAL: 2,
};

const ACTIONABLE_STATUSES = ['PENDING_VERIFICATION', 'VERIFIED'];
const REJECT_STATUSES = ['PENDING_VERIFICATION', 'VERIFIED', 'APPROVED'];
const CANCEL_STATUSES = ['PENDING_VERIFICATION', 'VERIFIED', 'APPROVED', 'ALLOCATING', 'RESERVED'];

function defaultOrganizationId(auth: ReturnType<typeof useAuth>): number | null {
  const memberships = auth.user?.memberships ?? [];
  if (auth.organizationId && memberships.some((item) => item.organizationId === auth.organizationId)) {
    return auth.organizationId;
  }
  const requestCapable = memberships.find(
    (item) =>
      item.role === 'HOSPITAL_ADMIN' ||
      item.role === 'MEDICAL_STAFF' ||
      item.role === 'PLATFORM_ADMIN' ||
      item.role === 'BLOOD_BANK_ADMIN',
  );
  return requestCapable?.organizationId ?? memberships[0]?.organizationId ?? auth.organizationId;
}

function emptyRequest(organizationId: number | null): RequestForm {
  return {
    organizationId: organizationId ? String(organizationId) : '',
    patientRef: '',
    bloodGroup: 'O_POSITIVE',
    componentType: 'RED_CELLS',
    quantity: '1',
    priority: 'URGENT',
    requiredBy: '',
    reason: '',
  };
}

function formatFreshness(updatedAt: number, now: number): string {
  if (!updatedAt) return 'awaiting first sync';
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 15) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function RequestsPage() {
  const auth = useAuth();
  const toast = useToast();
  const invalidateDomains = useInvalidateDomains();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'requiredBy', direction: 'asc' });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>(() => emptyRequest(defaultOrganizationId(auth)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionTarget, setActionTarget] = useState<{ id: number; kind: ReasonKind } | null>(null);
  const [reason, setReason] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const deepLinkedId = searchParams.get('requestId');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (deepLinkedId && /^\d+$/.test(deepLinkedId)) setSelectedId(Number(deepLinkedId));
  }, [deepLinkedId]);

  // The status filter is part of the key: changing it must refetch from the server.
  const requestsQuery = useQuery({
    queryKey: ['requests', 'list', status],
    queryFn: () => api.get<EmergencyRequestView[]>('/emergency-requests', {
      query: { status: status || undefined },
    }),
  });

  const detailQuery = useQuery({
    queryKey: ['requests', 'detail', selectedId],
    queryFn: () => api.get<EmergencyRequestDetail>(`/emergency-requests/${selectedId}`),
    enabled: selectedId !== null,
  });

  const invalidate = () => {
    invalidateDomains(['requests']);
  };

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: RequestAction }) => {
      if (kind === 'reject' || kind === 'cancel') {
        return api.post(`/emergency-requests/${id}/${kind}`, { reason: reason.trim() });
      }
      return api.post(`/emergency-requests/${id}/${kind}`);
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.kind === 'verify'
          ? 'Request verified'
          : variables.kind === 'approve'
            ? 'Request approved'
            : variables.kind === 'reject'
              ? 'Request rejected'
              : 'Request cancelled',
      );
      setActionTarget(null);
      setReason('');
      invalidate();
    },
    onError: (error) => toast.error('Action failed', getErrorMessage(error)),
  });

  const createRequest = useMutation({
    mutationFn: () => {
      const payload: CreateEmergencyRequestRequest = {
        organizationId: Number(form.organizationId),
        patientRef: form.patientRef.trim() || undefined,
        bloodGroup: form.bloodGroup,
        componentType: form.componentType,
        quantity: Number(form.quantity),
        priority: form.priority,
        requiredBy: fromDateTimeLocal(form.requiredBy) ?? '',
        reason: form.reason.trim() || undefined,
      };
      return api.post<EmergencyRequestView>('/emergency-requests', payload);
    },
    onSuccess: () => {
      toast.success('Emergency request created');
      setCreateOpen(false);
      setForm(emptyRequest(defaultOrganizationId(auth)));
      setErrors({});
      invalidate();
    },
    onError: (error) => toast.error('Could not create request', getErrorMessage(error)),
  });

  const submitCreate = () => {
    const next: Record<string, string> = {};
    if (!/^\d+$/.test(form.organizationId)) next.organizationId = 'Choose an organization.';
    const requiredBy = fromDateTimeLocal(form.requiredBy);
    if (!requiredBy) {
      next.requiredBy = 'Required by is when the blood is needed.';
    } else if (new Date(requiredBy).getTime() <= Date.now()) {
      next.requiredBy = 'Required by must be a future date and time.';
    }
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      next.quantity = 'Quantity must be between 1 and 99.';
    }
    setErrors(next);
    if (Object.keys(next).length === 0) createRequest.mutate();
  };

  const closeDetail = () => {
    setSelectedId(null);
    if (searchParams.has('requestId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('requestId');
      setSearchParams(next, { replace: true });
    }
  };

  const openReasonDialog = (id: number, kind: ReasonKind) => {
    // Close the drawer first so the reason dialog is never nested inside it.
    closeDetail();
    setActionTarget({ id, kind });
    setReason('');
  };

  const ownsRequest = (request: EmergencyRequestView) =>
    auth.user?.memberships.some((item) => item.organizationId === request.organizationId) ?? false;

  const canCancel = (request: EmergencyRequestView) =>
    auth.hasRole('PLATFORM_ADMIN') ||
    (ownsRequest(request) &&
      auth.hasAnyPermission([PERMISSIONS.REQUEST_CREATE, PERMISSIONS.REQUEST_APPROVE]));

  const allRequests = requestsQuery.data ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const requests = useMemo(() => {
    const filtered = allRequests.filter((request) => {
      const matchesTerm =
        !term ||
        `${request.requestNumber} ${request.publicId ?? ''} ${request.patientRef ?? ''} ${request.reason ?? ''} ${request.organizationName ?? ''}`
          .toLowerCase()
          .includes(term);
      return matchesTerm && (!priority || request.priority === priority);
    });
    return [...filtered].sort((a, b) => {
      let result = 0;
      switch (sort.key as RequestSortKey) {
        case 'priority':
          result = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
          break;
        case 'requiredBy':
          result = new Date(a.requiredBy).getTime() - new Date(b.requiredBy).getTime();
          break;
        case 'status':
          result = a.status.localeCompare(b.status);
          break;
        default:
          result = a.requestNumber.localeCompare(b.requestNumber);
      }
      return sort.direction === 'asc' ? result : -result;
    });
  }, [allRequests, priority, sort, term]);

  const detail = detailQuery.data?.request;
  const events = detailQuery.data?.events ?? [];
  const actionableCount = allRequests.filter((request) => ACTIONABLE_STATUSES.includes(request.status)).length;
  const urgentCount = allRequests.filter(
    (request) => request.priority === 'URGENT' || request.priority === 'CRITICAL',
  ).length;
  const fulfilledCount = allRequests.filter((request) => request.status === 'FULFILLED').length;

  const columns: DataTableColumn<EmergencyRequestView>[] = [
    {
      key: 'requestNumber',
      header: 'Request',
      sortable: true,
      render: (request) => (
        <div>
          <div className="table-cell-strong mono">{request.requestNumber}</div>
          <div className="text-xs text-subtle">
            {request.patientRef || request.organizationName || `Org #${request.organizationId}`}
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (request) => <StatusBadge status={request.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (request) => <StatusBadge status={request.status} />,
    },
    {
      key: 'bloodGroup',
      header: 'Requirement',
      render: (request) =>
        `${humanize(request.bloodGroup)} · ${humanize(request.componentType)} × ${request.quantity}`,
    },
    {
      key: 'requiredBy',
      header: 'Required by',
      sortable: true,
      render: (request) => formatDateTime(request.requiredBy),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (request) => (
        <div className="table-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(request.id)}>
            View
          </button>
          {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && request.status === 'PENDING_VERIFICATION' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={action.isPending}
              onClick={() => action.mutate({ id: request.id, kind: 'verify' })}
            >
              <ShieldCheck size={13} aria-hidden="true" /> Verify
            </button>
          )}
          {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && request.status === 'VERIFIED' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={action.isPending}
              onClick={() => action.mutate({ id: request.id, kind: 'approve' })}
            >
              Approve
            </button>
          )}
          {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && REJECT_STATUSES.includes(request.status) && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => openReasonDialog(request.id, 'reject')}
            >
              Reject
            </button>
          )}
          {CANCEL_STATUSES.includes(request.status) && canCancel(request) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openReasonDialog(request.id, 'cancel')}
            >
              Cancel
            </button>
          )}
        </div>
      ),
    },
  ];

  const handleSort = (key: string) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  return (
    <div className="app-page page-enter">
      <PageHeader
        eyebrow="Operations"
        title="Emergency requests"
        description="Raise requests and track verification, approval, and event history through the API."
        actions={
          auth.hasPermission(PERMISSIONS.REQUEST_CREATE) ? (
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden="true" /> New request
            </button>
          ) : undefined
        }
      />

      <div className="metric-grid">
        <div className="metric-card surface stagger-1">
          <span className="metric-label">Requests in view</span>
          <span className="metric-value">{allRequests.length}</span>
          <span className="metric-delta">{requests.length} after filters</span>
        </div>
        <div className="metric-card surface stagger-2">
          <span className="metric-label">Awaiting staff action</span>
          <span className="metric-value">{actionableCount}</span>
          <span className="metric-delta">Verification and approval</span>
        </div>
        <div className="metric-card surface stagger-3">
          <span className="metric-label">Urgent or critical</span>
          <span className="metric-value">{urgentCount}</span>
          <span className="metric-delta">Time-sensitive requests</span>
        </div>
        <div className="metric-card surface">
          <span className="metric-label">Fulfilled</span>
          <span className="metric-value">{fulfilledCount}</span>
          <span className="metric-delta">Completed through dispatch</span>
        </div>
      </div>

      <div className="task-grid" style={{ marginTop: 18 }}>
        <button
          type="button"
          className="task-card surface-interactive"
          onClick={() => setStatus('PENDING_VERIFICATION')}
        >
          <span className="task-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
          <span className="task-title">Pending verification</span>
          <span className="task-meta">{allRequests.filter((item) => item.status === 'PENDING_VERIFICATION').length} requests</span>
          <span className="task-cta">Filter list →</span>
        </button>
        <button
          type="button"
          className="task-card surface-interactive"
          onClick={() => setStatus('APPROVED')}
        >
          <span className="task-icon"><ClipboardList size={18} aria-hidden="true" /></span>
          <span className="task-title">Approved for allocation</span>
          <span className="task-meta">{allRequests.filter((item) => item.status === 'APPROVED').length} requests</span>
          <span className="task-cta">Filter list →</span>
        </button>
        <button
          type="button"
          className="task-card surface-interactive"
          onClick={() => setPriority('CRITICAL')}
        >
          <span className="task-icon"><Siren size={18} aria-hidden="true" /></span>
          <span className="task-title">Critical priority</span>
          <span className="task-meta">{allRequests.filter((item) => item.priority === 'CRITICAL').length} requests</span>
          <span className="task-cta">Filter list →</span>
        </button>
      </div>

      <div className="surface premium-table" style={{ marginTop: 18 }}>
        <DataTable
          ariaLabel="Emergency request list"
          rowKey={(row) => row.id}
          columns={columns}
          rows={requests}
          loading={requestsQuery.isPending}
          sort={sort}
          onSort={handleSort}
          onRowClick={(request) => setSelectedId(request.id)}
          emptyTitle="No emergency requests"
          emptyDescription="Requests raised by your organization will appear here."
          toolbar={
            <>
              <div className="toolbar">
                <div className="toolbar-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    className="input"
                    type="search"
                    aria-label="Search requests"
                    placeholder="Search requests…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="filter-grid">
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="request-status">Request status</label>
                    <select
                      id="request-status"
                      className="select"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="">All statuses</option>
                      {REQUEST_STATUSES.map((item) => (
                        <option key={item} value={item}>{humanize(item)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="request-priority">Request priority</label>
                    <select
                      id="request-priority"
                      className="select"
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                    >
                      <option value="">All priorities</option>
                      {PRIORITIES.map((item) => (
                        <option key={item} value={item}>{humanize(item)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <span className="freshness" aria-live="polite">
                  <span className="live-dot" aria-hidden="true" />
                  Updated {formatFreshness(requestsQuery.dataUpdatedAt, now)}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={requestsQuery.isFetching}
                  onClick={() => void requestsQuery.refetch()}
                >
                  <RefreshCw size={14} aria-hidden="true" /> Refresh
                </button>
              </div>
            </>
          }
        />
      </div>
      {requestsQuery.isError && (
        <div className="surface" style={{ marginTop: 16 }}>
          <ErrorState error={requestsQuery.error} onRetry={() => void requestsQuery.refetch()} />
        </div>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={closeDetail}
        title={detail ? `Request ${detail.requestNumber}` : 'Request detail'}
        description={detail ? `${humanize(detail.priority)} · ${humanize(detail.status)}` : undefined}
      >
        {detailQuery.isPending && <div className="skeleton-lines"><Skeleton height={18} /><Skeleton height={18} /></div>}
        {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />}
        {detail && (
          <>
            <div className="live-pill" style={{ marginBottom: 14 }}>
              <span className="live-dot" aria-hidden="true" />
              Live record · updated {formatFreshness(detailQuery.dataUpdatedAt, now)}
            </div>
            <dl className="detail-grid">
              <div className="detail-item"><dt>Status</dt><dd><StatusBadge status={detail.status} /></dd></div>
              <div className="detail-item"><dt>Priority</dt><dd><StatusBadge status={detail.priority} /></dd></div>
              <div className="detail-item"><dt>Required by</dt><dd>{formatDateTime(detail.requiredBy)}</dd></div>
              <div className="detail-item">
                <dt>Quantity</dt>
                <dd>{detail.quantity} {humanize(detail.componentType).toLowerCase()}</dd>
              </div>
              <div className="detail-item">
                <dt>Organization</dt>
                <dd>{detail.organizationName ?? `Organization #${detail.organizationId}`}</dd>
              </div>
              <div className="detail-item"><dt>Patient reference</dt><dd>{detail.patientRef ?? '—'}</dd></div>
              <div className="detail-item"><dt>Public ID</dt><dd className="mono">{detail.publicId ?? '—'}</dd></div>
              <div className="detail-item">
                <dt>Requirement</dt>
                <dd>{humanize(detail.bloodGroup)} · {humanize(detail.componentType)} × {detail.quantity}</dd>
              </div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <dt>Reason</dt>
                <dd>{detail.reason ?? '—'}</dd>
              </div>
            </dl>

            <div className="section-heading" style={{ marginTop: 20 }}>
              <h3>Event timeline</h3>
              <span className="status-chip">{events.length} recorded</span>
            </div>
            {events.length ? (
              <ol className="timeline-list">
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>{humanize(event.action)}</strong>
                    <div className="text-xs text-muted">
                      {formatDateTime(event.occurredAt)}
                      {event.actorId ? ` · User #${event.actorId}` : ''}
                    </div>
                    {event.notes && <p className="text-sm">{event.notes}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No events yet" description="Actions on this request are recorded here." />
            )}

            <div className="section-heading" style={{ marginTop: 20 }}>
              <h3>Next steps</h3>
            </div>
            <div className="form-actions">
              {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && detail.status === 'PENDING_VERIFICATION' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: detail.id, kind: 'verify' })}
                >
                  <ShieldCheck size={15} aria-hidden="true" /> Verify request
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && detail.status === 'VERIFIED' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: detail.id, kind: 'approve' })}
                >
                  <CheckCircle2 size={15} aria-hidden="true" /> Approve
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.ALLOCATION_REVIEW) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    closeDetail();
                    navigate(`/app/allocations?requestId=${detail.id}`);
                  }}
                >
                  Review allocations
                </button>
              )}
            </div>
            <div className="danger-zone">
              {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && REJECT_STATUSES.includes(detail.status) && (
                <button type="button" className="btn btn-danger" onClick={() => openReasonDialog(detail.id, 'reject')}>
                  <XCircle size={15} aria-hidden="true" /> Reject
                </button>
              )}
              {CANCEL_STATUSES.includes(detail.status) && canCancel(detail) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => openReasonDialog(detail.id, 'cancel')}
                >
                  Cancel request
                </button>
              )}
            </div>
          </>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New emergency request"
        description="Submitted through the emergency requests API."
        size="wide"
        footer={
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={createRequest.isPending} onClick={submitCreate}>
              Create request
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <FormField label="Organization" error={errors.organizationId} required full>
            {auth.user?.memberships.length ? (
              <select
                className="select"
                value={form.organizationId}
                onChange={(event) => setForm({ ...form, organizationId: event.target.value })}
              >
                <option value="">Select your active organization…</option>
                {auth.user.memberships.map((membership) => (
                  <option key={membership.organizationId} value={membership.organizationId}>
                    {membership.organizationName} · {humanize(membership.role)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                inputMode="numeric"
                value={form.organizationId}
                onChange={(event) => setForm({ ...form, organizationId: event.target.value })}
              />
            )}
          </FormField>
          <FormField label="Patient reference" hint="Optional">
            <input
              className="input"
              value={form.patientRef}
              onChange={(event) => setForm({ ...form, patientRef: event.target.value })}
            />
          </FormField>
          <FormField label="Priority" required>
            <select
              className="select"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value as EmergencyRequestPriority })}
            >
              {PRIORITIES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </select>
          </FormField>
          <FormField label="Blood group" required>
            <select
              className="select"
              value={form.bloodGroup}
              onChange={(event) => setForm({ ...form, bloodGroup: event.target.value as BloodGroup })}
            >
              {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{humanize(group)}</option>)}
            </select>
          </FormField>
          <FormField label="Component" required>
            <select
              className="select"
              value={form.componentType}
              onChange={(event) => setForm({ ...form, componentType: event.target.value as ComponentType })}
            >
              {COMPONENT_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
            </select>
          </FormField>
          <FormField label="Quantity" error={errors.quantity} required>
            <input
              className="input"
              type="number"
              min={1}
              max={99}
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
            />
          </FormField>
          <FormField label="Required by" error={errors.requiredBy} required>
            <input
              className="input"
              type="datetime-local"
              value={form.requiredBy}
              min={new Date(Date.now() - 60_000).toISOString().slice(0, 16)}
              onChange={(event) => setForm({ ...form, requiredBy: event.target.value })}
            />
          </FormField>
          <FormField label="Reason" hint="Optional" full>
            <textarea
              className="textarea"
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
          </FormField>
        </div>
        <p className="text-xs text-subtle" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Siren size={13} aria-hidden="true" /> Approval remains subject to your organization's procedures.
        </p>
      </Modal>

      <Modal
        open={actionTarget !== null}
        onClose={() => { setActionTarget(null); setReason(''); }}
        title={actionTarget?.kind === 'cancel' ? 'Cancel emergency request' : 'Reject emergency request'}
        description={actionTarget?.kind === 'cancel'
          ? 'The API requires a reason before a request can be cancelled.'
          : 'Provide a reason for the rejection.'}
        footer={
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setActionTarget(null); setReason(''); }}>
              Close
            </button>
            <button
              type="button"
              className={actionTarget?.kind === 'cancel' ? 'btn btn-secondary' : 'btn btn-danger'}
              disabled={!reason.trim() || action.isPending}
              onClick={() => actionTarget && action.mutate({ id: actionTarget.id, kind: actionTarget.kind })}
            >
              {actionTarget?.kind === 'cancel' ? 'Cancel request' : 'Reject request'}
            </button>
          </div>
        }
      >
        <FormField label="Reason" required full>
          <textarea className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
      </Modal>
    </div>
  );
}
