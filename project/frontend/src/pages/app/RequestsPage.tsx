import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Plus, Search, ShieldCheck, Siren, XCircle } from 'lucide-react';
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

export function RequestsPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>(() => emptyRequest(auth.organizationId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reasonDialog, setReasonDialog] = useState<'reject' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['requests', 'list'],
    queryFn: () => api.get<EmergencyRequestView[]>('/emergency-requests', {
      query: status ? { status } : undefined,
    }),
  });

  const detailQuery = useQuery({
    queryKey: ['requests', 'detail', selectedId],
    queryFn: () => api.get<EmergencyRequestDetail>(`/emergency-requests/${selectedId}`),
    enabled: selectedId !== null,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['requests'] });
    if (selectedId !== null) void queryClient.invalidateQueries({ queryKey: ['requests', 'detail', selectedId] });
  };

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: RequestAction }) => {
      if (kind === 'reject' || kind === 'cancel') {
        return api.post(`/emergency-requests/${id}/${kind}`, { reason: reason.trim() });
      }
      return api.post(`/emergency-requests/${id}/${kind}`);
    },
    onSuccess: (_, variables) => {
      toast.success(`Request ${variables.kind === 'verify' ? 'verified' : variables.kind === 'approve' ? 'approved' : variables.kind === 'reject' ? 'rejected' : 'cancelled'}`);
      setReasonDialog(null);
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
      setForm(emptyRequest(auth.organizationId));
      setErrors({});
      invalidate();
    },
    onError: (error) => toast.error('Could not create request', getErrorMessage(error)),
  });

  const submitCreate = () => {
    const next: Record<string, string> = {};
    if (!/^\d+$/.test(form.organizationId)) next.organizationId = 'Choose an organization.';
    if (!form.requiredBy) next.requiredBy = 'Required by is when the blood is needed.';
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      next.quantity = 'Quantity must be between 1 and 99.';
    }
    setErrors(next);
    if (Object.keys(next).length === 0) createRequest.mutate();
  };

  const allRequests = requestsQuery.data ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const requests = term
    ? allRequests.filter((request) =>
        `${request.requestNumber} ${request.publicId ?? ''} ${request.patientRef ?? ''} ${request.reason ?? ''} ${request.organizationName ?? ''}`
          .toLowerCase()
          .includes(term))
    : allRequests;

  const detail = detailQuery.data?.request;
  const events = detailQuery.data?.events ?? [];

  const rejectStates = ['PENDING_VERIFICATION', 'VERIFIED', 'APPROVED'];
  const cancelStates = ['PENDING_VERIFICATION', 'VERIFIED', 'APPROVED', 'ALLOCATING', 'RESERVED'];

  const columns: DataTableColumn<EmergencyRequestView>[] = [
    {
      key: 'requestNumber',
      header: 'Request',
      render: (request) => (
        <div>
          <div className="table-cell-strong mono">{request.requestNumber}</div>
          <div className="text-xs text-subtle">{request.patientRef || request.organizationName || `Org #${request.organizationId}`}</div>
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', render: (request) => <StatusBadge status={request.priority} /> },
    { key: 'status', header: 'Status', render: (request) => <StatusBadge status={request.status} /> },
    {
      key: 'bloodGroup',
      header: 'Requirement',
      render: (request) => `${humanize(request.bloodGroup)} · ${humanize(request.componentType)} × ${request.quantity}`,
    },
    { key: 'requiredBy', header: 'Required by', render: (request) => formatDateTime(request.requiredBy) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (request) => (
        <div className="table-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(request.id)}>View</button>
          {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && request.status === 'PENDING_VERIFICATION' && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={action.isPending} onClick={() => action.mutate({ id: request.id, kind: 'verify' })}>
              <ShieldCheck size={13} aria-hidden="true" /> Verify
            </button>
          )}
          {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && request.status === 'VERIFIED' && (
            <button type="button" className="btn btn-primary btn-sm" disabled={action.isPending} onClick={() => action.mutate({ id: request.id, kind: 'approve' })}>
              Approve
            </button>
          )}
          {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && rejectStates.includes(request.status) && (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => { setSelectedId(request.id); setReason(''); setReasonDialog('reject'); }}>Reject</button>
          )}
          {cancelStates.includes(request.status) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSelectedId(request.id); setReason(''); setReasonDialog('cancel'); }}>Cancel</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
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

      <DataTable
        ariaLabel="Emergency request list"
        rowKey={(row) => row.id}
        columns={columns}
        rows={requests}
        loading={requestsQuery.isPending}
        onRowClick={(request) => setSelectedId(request.id)}
        emptyTitle="No emergency requests"
        emptyDescription="Requests raised by your organization will appear here."
        toolbar={
          <>
            <div className="search-input-wrap">
              <Search size={15} aria-hidden="true" />
              <input className="input" type="search" aria-label="Search requests" placeholder="Search requests…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <label className="sr-only" htmlFor="request-status">Request status</label>
            <select id="request-status" className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {REQUEST_STATUSES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </select>
          </>
        }
      />
      {requestsQuery.isError && (
        <div className="card" style={{ marginTop: 16 }}>
          <ErrorState error={requestsQuery.error} onRetry={() => void requestsQuery.refetch()} />
        </div>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail ? `Request ${detail.requestNumber}` : 'Request detail'}
        description={detail ? `${humanize(detail.priority)} · ${humanize(detail.status)}` : undefined}
      >
        {detailQuery.isPending && <div className="skeleton-lines"><Skeleton height={18} /><Skeleton height={18} /></div>}
        {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />}
        {detail && (
          <>
            <dl className="detail-grid">
              <div className="detail-item"><dt>Status</dt><dd><StatusBadge status={detail.status} /></dd></div>
              <div className="detail-item"><dt>Priority</dt><dd><StatusBadge status={detail.priority} /></dd></div>
              <div className="detail-item"><dt>Required by</dt><dd>{formatDateTime(detail.requiredBy)}</dd></div>
              <div className="detail-item"><dt>Organization</dt><dd>{detail.organizationName ?? `Organization #${detail.organizationId}`}</dd></div>
              <div className="detail-item"><dt>Patient reference</dt><dd>{detail.patientRef ?? '—'}</dd></div>
              <div className="detail-item"><dt>Public ID</dt><dd className="mono">{detail.publicId ?? '—'}</dd></div>
              <div className="detail-item">
                <dt>Requirement</dt>
                <dd>{humanize(detail.bloodGroup)} · {humanize(detail.componentType)} × {detail.quantity}</dd>
              </div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}><dt>Reason</dt><dd>{detail.reason ?? '—'}</dd></div>
            </dl>

            <hr className="divider" />
            <h3>Event history</h3>
            {events.length ? (
              <ol className="timeline" style={{ marginTop: 16 }}>
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>{humanize(event.action)}</strong>
                    <div className="text-xs text-muted">
                      {formatDateTime(event.occurredAt)}{event.actorId ? ` · User #${event.actorId}` : ''}
                    </div>
                    {event.notes && <p className="text-sm">{event.notes}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No events yet" description="Actions on this request are recorded here." />
            )}

            <div className="action-row">
              {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && detail.status === 'PENDING_VERIFICATION' && (
                <button type="button" className="btn btn-primary" disabled={action.isPending} onClick={() => action.mutate({ id: detail.id, kind: 'verify' })}>
                  <ShieldCheck size={15} aria-hidden="true" /> Verify request
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && detail.status === 'VERIFIED' && (
                <button type="button" className="btn btn-primary" disabled={action.isPending} onClick={() => action.mutate({ id: detail.id, kind: 'approve' })}>
                  <CheckCircle2 size={15} aria-hidden="true" /> Approve
                </button>
              )}
              {auth.hasPermission(PERMISSIONS.REQUEST_APPROVE) && rejectStates.includes(detail.status) && (
                <button type="button" className="btn btn-danger" onClick={() => { setReason(''); setReasonDialog('reject'); }}>
                  <XCircle size={15} aria-hidden="true" /> Reject
                </button>
              )}
              {cancelStates.includes(detail.status) && (
                <button type="button" className="btn btn-secondary" onClick={() => { setReason(''); setReasonDialog('cancel'); }}>Cancel request</button>
              )}
              {auth.hasPermission(PERMISSIONS.ALLOCATION_REVIEW) && (
                <button type="button" className="btn btn-secondary" onClick={() => { setSelectedId(null); navigate(`/app/allocations?requestId=${detail.id}`); }}>
                  Review allocations
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
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={createRequest.isPending} onClick={submitCreate}>Create request</button>
          </>
        }
      >
        <div className="form-grid">
          <FormField label="Organization ID" error={errors.organizationId} required full>
            <input className="input" inputMode="numeric" value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })} />
          </FormField>
          <FormField label="Patient reference" hint="Optional">
            <input className="input" value={form.patientRef} onChange={(event) => setForm({ ...form, patientRef: event.target.value })} />
          </FormField>
          <FormField label="Priority" required>
            <select className="select" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as EmergencyRequestPriority })}>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}
            </select>
          </FormField>
          <FormField label="Blood group" required>
            <select className="select" value={form.bloodGroup} onChange={(event) => setForm({ ...form, bloodGroup: event.target.value as BloodGroup })}>
              {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{humanize(group)}</option>)}
            </select>
          </FormField>
          <FormField label="Component" required>
            <select className="select" value={form.componentType} onChange={(event) => setForm({ ...form, componentType: event.target.value as ComponentType })}>
              {COMPONENT_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
            </select>
          </FormField>
          <FormField label="Quantity" error={errors.quantity} required>
            <input className="input" type="number" min={1} max={99} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </FormField>
          <FormField label="Required by" error={errors.requiredBy} required>
            <input className="input" type="datetime-local" value={form.requiredBy} onChange={(event) => setForm({ ...form, requiredBy: event.target.value })} />
          </FormField>
          <FormField label="Reason" hint="Optional" full>
            <textarea className="textarea" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          </FormField>
        </div>
        <p className="text-xs text-subtle" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Siren size={13} aria-hidden="true" /> Approval remains subject to your organization's procedures.
        </p>
      </Modal>

      <Modal
        open={reasonDialog !== null}
        onClose={() => { setReasonDialog(null); setReason(''); }}
        title={reasonDialog === 'cancel' ? 'Cancel emergency request' : 'Reject emergency request'}
        description={reasonDialog === 'cancel'
          ? 'The API requires a reason before a request can be cancelled.'
          : 'Provide a reason for the rejection.'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setReasonDialog(null); setReason(''); }}>Close</button>
            <button
              type="button"
              className={reasonDialog === 'cancel' ? 'btn btn-secondary' : 'btn btn-danger'}
              disabled={!reason.trim() || action.isPending}
              onClick={() => selectedId && reasonDialog && action.mutate({ id: selectedId, kind: reasonDialog })}
            >
              {reasonDialog === 'cancel' ? 'Cancel request' : 'Reject request'}
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
