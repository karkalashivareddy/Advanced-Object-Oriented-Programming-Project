import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { COMPONENT_TYPES, DONATION_STATUSES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { auditKeys, useInvalidateDomains } from '@/lib/queryCache';
import { formatDateTime, fromDateTimeLocal, humanize, toDateTimeLocal } from '@/lib/utils';
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
import type { PageResponse } from '@/types/api';
import type {
  AuditLogView,
  BloodUnitView,
  ComponentType,
  DonationView,
  DonorView,
  OrganizationView,
} from '@/types/domain';

type ActionKind = 'screen' | 'approve' | 'reject';

interface ActionTarget {
  id: number;
  kind: ActionKind;
}

interface DonationForm {
  donorId: string;
  organizationId: string;
  donatedAt: string;
  notes: string;
}

interface CreateDonationRequest {
  donorId: number;
  organizationId: number;
  appointmentId?: number;
  donatedAt?: string;
  notes?: string;
}

const PAGE_SIZE = 10;

function emptyDonationForm(organizationId: number | null): DonationForm {
  return {
    donorId: '',
    organizationId: organizationId ? String(organizationId) : '',
    donatedAt: toDateTimeLocal(new Date().toISOString()),
    notes: '',
  };
}

function statusOf(donation: DonationView): string {
  return donation.status.toUpperCase();
}

function screeningLabel(metadata?: string | null): string {
  if (!metadata) return 'Screening event';
  if (metadata.includes('passed=true')) return 'Passed screening';
  if (metadata.includes('passed=false')) return 'Failed screening';
  return 'Screening event';
}

export function DonationsPage() {
  const auth = useAuth();
  const toast = useToast();
  const invalidateDomains = useInvalidateDomains();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [donorFilter, setDonorFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState<DonationForm>(() => emptyDonationForm(auth.organizationId));
  const [recordErrors, setRecordErrors] = useState<Record<string, string>>({});
  const [screening, setScreening] = useState({ passed: true, notes: '' });
  const [reason, setReason] = useState('');
  const [components, setComponents] = useState<ComponentType[]>(['RED_CELLS']);

  const canChooseOrganization = auth.hasPermission(PERMISSIONS.ORGANIZATION_READ);
  const activeMembership =
    auth.user?.memberships.find((membership) => membership.organizationId === auth.organizationId) ??
    auth.user?.memberships[0];
  const scopedOrganizationId = orgFilter || auth.organizationId || '';

  const donorsQuery = useQuery({
    queryKey: ['donors', 'list'],
    queryFn: () => api.get<DonorView[]>('/donors'),
    enabled: auth.hasPermission(PERMISSIONS.DONOR_READ),
  });

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'options', auth.organizationId],
    queryFn: () => api.get<PageResponse<OrganizationView>>('/organizations', { query: { size: 100 } }),
    enabled: canChooseOrganization,
  });

  useEffect(() => {
    if (!auth.organizationId && !orgFilter && organizationsQuery.data?.content.length) {
      setOrgFilter(String(organizationsQuery.data.content[0].id));
    }
  }, [auth.organizationId, orgFilter, organizationsQuery.data]);

  const donationsQuery = useQuery({
    queryKey: ['donations', 'list', donorFilter, scopedOrganizationId, auth.organizationId],
    queryFn: () =>
      api.get<DonationView[]>('/donations', {
        query: {
          donorId: donorFilter || undefined,
          organizationId: scopedOrganizationId || undefined,
        },
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['donations', 'detail', selectedId],
    queryFn: () => api.get<DonationView>(`/donations/${selectedId}`),
    enabled: selectedId !== null,
  });

  const unitsQuery = useQuery({
    queryKey: ['donations', selectedId, 'units'],
    queryFn: () => api.get<BloodUnitView[]>(`/donations/${selectedId}/units`),
    enabled: selectedId !== null,
  });

  // Screening records have no dedicated GET endpoint; the audit log is the
  // authoritative source and is filtered to this donation's public ID.
  const screeningHistoryQuery = useQuery({
    queryKey: auditKeys.donationScreening(selectedId, auth.organizationId),
    queryFn: () =>
      api.get<PageResponse<AuditLogView>>('/audit-logs', {
        query: { action: 'DONATION_SCREEN', size: 100 },
      }),
    enabled: selectedId !== null && auth.hasPermission(PERMISSIONS.AUDIT_READ),
  });

  const membershipOptions = (auth.user?.memberships ?? []).map((membership) => ({
    id: membership.organizationId,
    name: membership.organizationName,
  }));
  const organizationOptions = Array.from(
    new Map(
      (canChooseOrganization && organizationsQuery.data?.content.length
        ? organizationsQuery.data.content.map((organization) => ({ id: organization.id, name: organization.name }))
        : membershipOptions
      ).map((option) => [option.id, option]),
    ).values(),
  );

  const invalidate = () => invalidateDomains(['donations', 'donors']);

  const mutation = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: ActionKind }) => {
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
      setActionTarget(null);
      setScreening({ passed: true, notes: '' });
      setReason('');
      invalidateDomains(['donations', 'donors', 'inventory', 'audit']);
      setSelectedId(variables.id);
    },
    onError: (error) => toast.error('Action failed', getErrorMessage(error)),
  });

  const recordDonation = useMutation({
    mutationFn: (payload: CreateDonationRequest) => api.post<DonationView>('/donations', payload),
    onSuccess: (donation) => {
      toast.success('Donation recorded');
      setRecordOpen(false);
      setRecordForm(emptyDonationForm(auth.organizationId));
      setRecordErrors({});
      invalidate();
      setSelectedId(donation.id);
    },
    onError: (error) => toast.error('Could not record donation', getErrorMessage(error)),
  });

  const openDetail = (id: number) => {
    setActionTarget(null);
    setSelectedId(id);
  };

  const openAction = (kind: ActionKind, donation: DonationView) => {
    mutation.reset();
    if (kind === 'screen') setScreening({ passed: true, notes: '' });
    if (kind === 'reject') setReason('');
    if (kind === 'approve') setComponents(['RED_CELLS']);
    setSelectedId(null);
    setActionTarget({ id: donation.id, kind });
  };

  const openRecord = () => {
    recordDonation.reset();
    setRecordForm(emptyDonationForm(auth.organizationId));
    setRecordErrors({});
    setSelectedId(null);
    setRecordOpen(true);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setDonorFilter('');
    setOrgFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

  const canScreen = (donation: DonationView) =>
    auth.hasPermission(PERMISSIONS.SCREENING_REVIEW) && statusOf(donation) === 'RECORDED';
  const canApprove = (donation: DonationView) =>
    auth.hasPermission(PERMISSIONS.DONATION_APPROVE) && statusOf(donation) === 'SCREENED';
  const canReject = (donation: DonationView) =>
    auth.hasPermission(PERMISSIONS.DONATION_APPROVE) && ['RECORDED', 'SCREENED'].includes(statusOf(donation));

  const allDonations = donationsQuery.data ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
  const filteredDonations = allDonations.filter((donation) => {
    const donatedAt = new Date(donation.donatedAt).getTime();
    const matchesTerm =
      !term ||
      `${donation.publicId ?? ''} ${donation.donorName ?? ''} ${donation.donorId} ${donation.notes ?? ''}`
        .toLowerCase()
        .includes(term);
    const matchesDate =
      (fromMs === null || Number.isNaN(fromMs) || donatedAt >= fromMs) &&
      (toMs === null || Number.isNaN(toMs) || donatedAt <= toMs);
    return matchesTerm && (!status || statusOf(donation) === status) && matchesDate;
  });
  const totalPages = Math.max(1, Math.ceil(filteredDonations.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const donations = filteredDonations.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const units = unitsQuery.data ?? [];
  const detail = detailQuery.data;
  const screeningHistory = detail?.publicId
    ? (screeningHistoryQuery.data?.content ?? []).filter((log) => log.targetId === detail.publicId)
    : [];

  const submitRecord = () => {
    const next: Record<string, string> = {};
    if (!/^\d+$/.test(recordForm.donorId) || Number(recordForm.donorId) <= 0) {
      next.donorId = 'Select an existing donor.';
    }
    if (!/^\d+$/.test(recordForm.organizationId) || Number(recordForm.organizationId) <= 0) {
      next.organizationId = 'Select an organization.';
    }
    const donatedAt = recordForm.donatedAt ? new Date(recordForm.donatedAt).getTime() : Number.NaN;
    if (!recordForm.donatedAt || Number.isNaN(donatedAt)) {
      next.donatedAt = 'Enter the donation date and time.';
    } else if (donatedAt > Date.now() + 60_000) {
      next.donatedAt = 'Donation time cannot be in the future.';
    }
    setRecordErrors(next);
    if (Object.keys(next).length > 0) return;
    recordDonation.mutate({
      donorId: Number(recordForm.donorId),
      organizationId: Number(recordForm.organizationId),
      donatedAt: fromDateTimeLocal(recordForm.donatedAt),
      notes: recordForm.notes.trim() || undefined,
    });
  };

  const renderActions = (donation: DonationView) => (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDetail(donation.id)}>
        View
      </button>
      {canScreen(donation) && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAction('screen', donation)}>
          Screen
        </button>
      )}
      {canApprove(donation) && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => openAction('approve', donation)}>
          Approve
        </button>
      )}
      {canReject(donation) && (
        <button type="button" className="btn btn-danger btn-sm" onClick={() => openAction('reject', donation)}>
          Reject
        </button>
      )}
    </>
  );

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
    {
      key: 'donorName',
      header: 'Donor',
      render: (donation) => donation.donorName ?? `Donor #${donation.donorId}`,
    },
    { key: 'status', header: 'Status', render: (donation) => <StatusBadge status={donation.status} /> },
    { key: 'donatedAt', header: 'Donated', render: (donation) => formatDateTime(donation.donatedAt) },
    {
      key: 'organizationId',
      header: 'Organization',
      render: (donation) =>
        organizationOptions.find((option) => option.id === donation.organizationId)?.name ??
        `Organization #${donation.organizationId}`,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (donation) => (
        <div
          className="table-actions"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {renderActions(donation)}
        </div>
      ),
    },
  ];

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Operations"
        title="Donations"
        description="Record donations, screen eligibility, approve units and trace their history."
        actions={
          auth.hasPermission(PERMISSIONS.DONATION_RECORD) ? (
            <button type="button" className="btn btn-primary" onClick={openRecord}>
              <Plus size={16} aria-hidden="true" /> Record donation
            </button>
          ) : undefined
        }
      />

      <section className="metric-grid page-enter stagger-1" aria-label="Donation summary">
        <article className="metric-card surface">
          <span className="metric-label">Donations returned</span>
          <strong className="metric-value">{allDonations.length}</strong>
          <span className="metric-delta">For the selected organization</span>
        </article>
        <article className="metric-card surface">
          <span className="metric-label">Awaiting screening</span>
          <strong className="metric-value">
            {allDonations.filter((donation) => statusOf(donation) === 'RECORDED').length}
          </strong>
          <span className="metric-delta">Status: recorded</span>
        </article>
        <article className="metric-card surface">
          <span className="metric-label">Approved</span>
          <strong className="metric-value">
            {allDonations.filter((donation) => statusOf(donation) === 'APPROVED').length}
          </strong>
          <span className="metric-delta">Units created by the API</span>
        </article>
      </section>

      <DataTable
        ariaLabel="Donation list"
        caption="Donations returned by the donations API"
        loadingLabel="Loading donations…"
        rowKey={(row) => row.id}
        columns={columns}
        rows={donations}
        loading={donationsQuery.isPending}
        page={safePage}
        size={PAGE_SIZE}
        totalElements={filteredDonations.length}
        onPageChange={setPage}
        onRowClick={(donation) => openDetail(donation.id)}
        emptyTitle="No donations found"
        emptyDescription="Adjust the filters or record a new donation if your role permits it."
        emptyAction={
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
            <RotateCcw size={14} aria-hidden="true" /> Clear filters
          </button>
        }
        mobileCard={(donation) => (
          <>
            <strong className="task-title mono">{donation.publicId ?? `DON-${donation.id}`}</strong>
            <dl className="mobile-card-fields">
              <div>
                <dt>Donor</dt>
                <dd>{donation.donorName ?? `Donor #${donation.donorId}`}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={donation.status} />
                </dd>
              </div>
              <div>
                <dt>Donated</dt>
                <dd>{formatDateTime(donation.donatedAt)}</dd>
              </div>
            </dl>
            <div className="action-row">{renderActions(donation)}</div>
          </>
        )}
        toolbar={
          <div className="surface-interactive" style={{ width: '100%' }}>
            <div className="filter-grid">
              <div className="filter-field">
                <label htmlFor="donation-search">Search donations</label>
                <div className="search-input-wrap">
                  <Search size={15} aria-hidden="true" />
                  <input
                    id="donation-search"
                    className="input toolbar-search"
                    type="search"
                    aria-describedby="donation-filter-note"
                    placeholder="Public ID, donor or notes…"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <span className="text-xs text-subtle" id="donation-filter-note">
                  Donor and organization are API filters; search and date range apply to the returned list.
                </span>
              </div>
              <div className="filter-field">
                <label htmlFor="donation-donor">Donor</label>
                <select
                  id="donation-donor"
                  className="select"
                  value={donorFilter}
                  onChange={(event) => {
                    setDonorFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All donors</option>
                  {(donorsQuery.data ?? []).map((donor) => (
                    <option key={donor.id} value={donor.id}>
                      {donor.fullName}
                    </option>
                  ))}
                </select>
                {donorsQuery.isError && (
                  <span className="text-xs text-warning" role="alert">
                    Donor options unavailable: {getErrorMessage(donorsQuery.error)}
                  </span>
                )}
              </div>
              <div className="filter-field">
                <label htmlFor="donation-org">Organization</label>
                <select
                  id="donation-org"
                  className="select"
                  value={scopedOrganizationId}
                  onChange={(event) => {
                    setOrgFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Active organization</option>
                  {organizationOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="donation-status">Status</label>
                <select
                  id="donation-status"
                  className="select"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All statuses</option>
                  {DONATION_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="donation-date-from">Donated from</label>
                <input
                  id="donation-date-from"
                  className="input"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="filter-field">
                <label htmlFor="donation-date-to">Donated to</label>
                <input
                  id="donation-date-to"
                  className="input"
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="section-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  <RotateCcw size={14} aria-hidden="true" /> Reset
                </button>
              </div>
            </div>
          </div>
        }
      />

      {donationsQuery.isError && (
        <div className="surface" style={{ marginTop: 16 }}>
          <ErrorState error={donationsQuery.error} onRetry={() => void donationsQuery.refetch()} />
        </div>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail ? `Donation ${detail.publicId ?? `#${detail.id}`}` : 'Donation'}
        description={detail?.donorName}
      >
        {detailQuery.isPending && (
          <div className="skeleton-lines" role="status" aria-live="polite">
            <Skeleton height={18} />
            <Skeleton height={18} />
          </div>
        )}
        {detailQuery.isError && (
          <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
        )}
        {detail && (
          <>
            <div className="section-heading">
              <h3>Donation details</h3>
              <StatusBadge status={detail.status} />
            </div>
            <dl className="detail-grid">
              <div className="detail-item">
                <dt>Donor ID</dt>
                <dd className="mono">{detail.donorId}</dd>
              </div>
              <div className="detail-item">
                <dt>Organization ID</dt>
                <dd>{detail.organizationId}</dd>
              </div>
              <div className="detail-item">
                <dt>Appointment ID</dt>
                <dd>{detail.appointmentId ?? '—'}</dd>
              </div>
              <div className="detail-item">
                <dt>Donated</dt>
                <dd>{formatDateTime(detail.donatedAt)}</dd>
              </div>
              <div className="detail-item">
                <dt>Public ID</dt>
                <dd className="mono">{detail.publicId ?? '—'}</dd>
              </div>
              {detail.notes && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <dt>Notes</dt>
                  <dd>{detail.notes}</dd>
                </div>
              )}
            </dl>

            <section className="surface surface-raised" style={{ marginTop: 16 }}>
              <div className="section-heading">
                <h3>Resulting units</h3>
                <span className="status-chip">{units.length} units</span>
              </div>
              {unitsQuery.isPending && <Skeleton height={60} />}
              {unitsQuery.isError && (
                <ErrorState
                  error={unitsQuery.error}
                  title="Units could not be loaded"
                  onRetry={() => void unitsQuery.refetch()}
                />
              )}
              {unitsQuery.isSuccess && units.length === 0 && (
                <EmptyState title="No units yet" description="Units appear here after an approved donation." />
              )}
              {units.length > 0 && (
                <ul className="timeline-list">
                  {units.map((unit) => (
                    <li key={unit.id}>
                      <div className="item-header">
                        <div>
                          <strong className="mono">{unit.unitNumber}</strong>
                          <div className="text-xs text-muted">
                            {humanize(unit.bloodGroup)} · {humanize(unit.componentType)}
                          </div>
                        </div>
                        <StatusBadge status={unit.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface surface-raised" style={{ marginTop: 16 }}>
              <div className="section-heading">
                <h3>Screening history</h3>
                <span className="status-chip">Audit log</span>
              </div>
              {!auth.hasPermission(PERMISSIONS.AUDIT_READ) && (
                <p className="text-sm text-subtle">
                  Screening history requires audit-read permission. The current screening result is shown in the
                  donation status above.
                </p>
              )}
              {auth.hasPermission(PERMISSIONS.AUDIT_READ) && screeningHistoryQuery.isPending && (
                <Skeleton height={48} />
              )}
              {auth.hasPermission(PERMISSIONS.AUDIT_READ) && screeningHistoryQuery.isError && (
                <ErrorState
                  error={screeningHistoryQuery.error}
                  title="Screening history could not be loaded"
                  onRetry={() => void screeningHistoryQuery.refetch()}
                />
              )}
              {auth.hasPermission(PERMISSIONS.AUDIT_READ) &&
                screeningHistoryQuery.isSuccess &&
                screeningHistory.length === 0 && (
                  <EmptyState
                    title="No screening events"
                    description="Record a screening result to add an audited event for this donation."
                  />
                )}
              {screeningHistory.length > 0 && (
                <ul className="timeline-list">
                  {screeningHistory.map((log) => (
                    <li key={`${log.id}-${log.occurredAt}`}>
                      <strong>{screeningLabel(log.metadata)}</strong>
                      <div className="text-xs text-muted">{formatDateTime(log.occurredAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="action-row" style={{ marginTop: 16 }}>
              {canScreen(detail) && (
                <button type="button" className="btn btn-secondary" onClick={() => openAction('screen', detail)}>
                  <ClipboardCheck size={15} aria-hidden="true" /> Record screening
                </button>
              )}
              {canApprove(detail) && (
                <button type="button" className="btn btn-primary" onClick={() => openAction('approve', detail)}>
                  <CheckCircle2 size={15} aria-hidden="true" /> Approve donation
                </button>
              )}
              {canReject(detail) && (
                <button type="button" className="btn btn-danger" onClick={() => openAction('reject', detail)}>
                  <XCircle size={15} aria-hidden="true" /> Reject donation
                </button>
              )}
              {!canScreen(detail) && !canApprove(detail) && !canReject(detail) && (
                <p className="text-sm text-subtle">No actions are available for this donation status.</p>
              )}
            </div>
          </>
        )}
      </Drawer>

      <Modal
        open={actionTarget?.kind === 'screen'}
        onClose={() => setActionTarget(null)}
        title="Record screening result"
        description="Screening is submitted to the donations API and added to the audit log."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setActionTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={mutation.isPending || !screening.notes.trim() || actionTarget === null}
              onClick={() => actionTarget && mutation.mutate({ id: actionTarget.id, kind: 'screen' })}
            >
              {mutation.isPending ? 'Saving screening…' : 'Save screening'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <fieldset className="form-field form-field-full">
            <legend>Screening outcome</legend>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={screening.passed}
                onChange={(event) => setScreening({ ...screening, passed: event.target.checked })}
              />
              Screening passed
            </label>
          </fieldset>
          <FormField label="Notes" required full>
            <textarea
              className="textarea"
              value={screening.notes}
              onChange={(event) => setScreening({ ...screening, notes: event.target.value })}
            />
          </FormField>
        </div>
        {mutation.isError && (
          <div className="alert alert-danger" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>Could not record screening: {getErrorMessage(mutation.error)}</span>
          </div>
        )}
      </Modal>

      <Modal
        open={actionTarget?.kind === 'approve'}
        onClose={() => setActionTarget(null)}
        title="Approve donation"
        description="Choose the components that the API should create as quarantined blood units."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setActionTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={mutation.isPending || components.length === 0 || actionTarget === null}
              onClick={() => actionTarget && mutation.mutate({ id: actionTarget.id, kind: 'approve' })}
            >
              {mutation.isPending ? 'Approving…' : 'Approve and create units'}
            </button>
          </>
        }
      >
        <fieldset className="form-field form-field-full">
          <legend>Components to create</legend>
          <span className="field-hint">At least one component is required.</span>
          <div className="cluster">
            {COMPONENT_TYPES.map((component) => (
              <label className="checkbox-row" key={component}>
                <input
                  type="checkbox"
                  checked={components.includes(component)}
                  onChange={(event) =>
                    setComponents((current) =>
                      event.target.checked
                        ? [...current, component]
                        : current.filter((item) => item !== component),
                    )
                  }
                />
                {humanize(component)}
              </label>
            ))}
          </div>
        </fieldset>
        {mutation.isError && (
          <div className="alert alert-danger" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>Could not approve donation: {getErrorMessage(mutation.error)}</span>
          </div>
        )}
      </Modal>

      <Modal
        open={actionTarget?.kind === 'reject'}
        onClose={() => setActionTarget(null)}
        title="Reject donation"
        description="A reason is required and is attached to the donation record."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setActionTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={mutation.isPending || !reason.trim() || actionTarget === null}
              onClick={() => actionTarget && mutation.mutate({ id: actionTarget.id, kind: 'reject' })}
            >
              {mutation.isPending ? 'Rejecting…' : 'Reject donation'}
            </button>
          </>
        }
      >
        <FormField label="Reason" required full>
          <textarea className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
        {mutation.isError && (
          <div className="alert alert-danger" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>Could not reject donation: {getErrorMessage(mutation.error)}</span>
          </div>
        )}
      </Modal>

      <Modal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="Record donation"
        description="Creates a donation through the API using existing donor and organization IDs."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRecordOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={recordDonation.isPending} onClick={submitRecord}>
              {recordDonation.isPending ? 'Recording donation…' : 'Record donation'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <FormField label="Donor" error={recordErrors.donorId} required full>
            <select
              className="select"
              value={recordForm.donorId}
              onChange={(event) => setRecordForm({ ...recordForm, donorId: event.target.value })}
            >
              <option value="">Select a donor…</option>
              {(donorsQuery.data ?? []).map((donor) => (
                <option key={donor.id} value={donor.id}>
                  {donor.fullName} · {donor.email}
                </option>
              ))}
            </select>
          </FormField>
          {donorsQuery.isPending && <Skeleton height={36} width="100%" />}
          {donorsQuery.isError && (
            <ErrorState
              error={donorsQuery.error}
              title="Donors could not be loaded"
              onRetry={() => void donorsQuery.refetch()}
            />
          )}
          {donorsQuery.isSuccess && (donorsQuery.data ?? []).length === 0 && (
            <EmptyState
              title="No donor profiles available"
              description="Link an existing account from the donors page first."
              action={
                <Link className="btn btn-secondary btn-sm" to="/app/donors">
                  Open donors
                </Link>
              }
            />
          )}
          <FormField
            label="Organization"
            error={recordErrors.organizationId}
            hint="Defaults to your active membership"
            required
            full
          >
            <select
              className="select"
              value={recordForm.organizationId}
              onChange={(event) => setRecordForm({ ...recordForm, organizationId: event.target.value })}
            >
              <option value="">Select an organization</option>
              {organizationOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </FormField>
          {canChooseOrganization && organizationsQuery.isError && (
            <ErrorState
              error={organizationsQuery.error}
              title="Organizations could not be loaded"
              onRetry={() => void organizationsQuery.refetch()}
            />
          )}
          <FormField label="Donated at" error={recordErrors.donatedAt} required full>
            <input
              className="input"
              type="datetime-local"
              value={recordForm.donatedAt}
              onChange={(event) => setRecordForm({ ...recordForm, donatedAt: event.target.value })}
            />
          </FormField>
          <FormField label="Notes" hint="Optional" full>
            <textarea
              className="textarea"
              value={recordForm.notes}
              onChange={(event) => setRecordForm({ ...recordForm, notes: event.target.value })}
            />
          </FormField>
        </div>
        {recordDonation.isError && (
          <div className="alert alert-danger" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>Could not record donation: {getErrorMessage(recordDonation.error)}</span>
          </div>
        )}
        {activeMembership && (
          <p className="text-xs text-subtle" style={{ marginTop: 12 }}>
            Active organization: {activeMembership.organizationName}. Appointments can be linked from the donor drawer.
          </p>
        )}
      </Modal>
    </div>
  );
}
