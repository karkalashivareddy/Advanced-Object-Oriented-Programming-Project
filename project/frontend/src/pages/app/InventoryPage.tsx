import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { BLOOD_GROUPS, COMPONENT_TYPES, UNIT_STATUSES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { useInvalidateDomains } from '@/lib/queryCache';
import { activeMembership as resolveActiveMembership } from '@/lib/organization';
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatNumber,
  fromDateTimeLocal,
  humanize,
} from '@/lib/utils';
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
import type { PageResponse } from '@/types/api';
import type {
  BloodUnitView,
  CreateUnitRequest,
  InventoryAdjustmentRequest,
  InventoryAlerts,
  MovementView,
  OrganizationView,
} from '@/types/domain';

type UnitAction = 'release' | 'expire';

interface PendingAction {
  id: number;
  unitNumber: string;
  action: UnitAction;
}

const PAGE_SIZE = 20;

function emptyUnit(organizationId: number | null): CreateUnitRequest {
  return {
    organizationId: organizationId ?? 0,
    unitNumber: '',
    bloodGroup: 'O_POSITIVE',
    componentType: 'RED_CELLS',
    collectedAt: '',
    expiresAt: '',
    storageLocation: '',
  };
}

function freshnessLabel(updatedAt: number | undefined, now: number): string {
  if (!updatedAt) return 'Waiting for the first response';
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 10) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.floor(minutes / 60)}h ago`;
}

export function InventoryPage() {
  const auth = useAuth();
  const toast = useToast();
  const invalidateDomains = useInvalidateDomains();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [bloodGroup, setBloodGroup] = useState('');
  const [componentType, setComponentType] = useState('');
  const [status, setStatus] = useState('');
  const [expiringWithinDays, setExpiringWithinDays] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>({ key: 'expiresAt', direction: 'asc' });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newUnit, setNewUnit] = useState<CreateUnitRequest>(() => emptyUnit(auth.organizationId));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [adjustment, setAdjustment] = useState({ delta: '', reason: '', location: '' });
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeMembership = resolveActiveMembership(auth.user?.memberships, auth.organizationId);
  const activeOrganizationId = auth.organizationId;
  const canChooseOrganization = auth.hasPermission(PERMISSIONS.ORGANIZATION_READ);

  // The inventory API exposes organization, group, component, status and expiry
  // filters, plus paging/sorting. It has no text-search parameter.
  const inventoryQuery = useQuery({
    queryKey: [
      'inventory',
      'list',
      bloodGroup,
      componentType,
      status,
      expiringWithinDays,
      page,
      sort,
      auth.organizationId,
    ],
    queryFn: () =>
      api.get<PageResponse<BloodUnitView>>('/inventory', {
        query: {
          bloodGroup: bloodGroup || undefined,
          componentType: componentType || undefined,
          status: status || undefined,
          expiringWithinDays: expiringWithinDays || undefined,
          organizationId: auth.organizationId ?? undefined,
          page,
          size: PAGE_SIZE,
          sort: `${sort.key},${sort.direction}`,
        },
      }),
  });

  const alertsQuery = useQuery({
    queryKey: ['inventory', 'alerts', auth.organizationId],
    queryFn: () => api.get<InventoryAlerts>('/inventory/alerts'),
  });

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'options', auth.organizationId],
    queryFn: () => api.get<PageResponse<OrganizationView>>('/organizations', { query: { size: 100 } }),
    enabled: addOpen && canChooseOrganization,
  });

  const detailQuery = useQuery({
    queryKey: ['inventory', 'detail', selectedId],
    queryFn: () => api.get<BloodUnitView>(`/inventory/${selectedId}`),
    enabled: selectedId !== null,
  });

  const movementsQuery = useQuery({
    queryKey: ['inventory', 'movements', selectedId],
    queryFn: () => api.get<MovementView[]>(`/inventory/${selectedId}/movements`),
    enabled: selectedId !== null,
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

  const invalidate = () => {
    invalidateDomains(['inventory']);
  };

  const unitAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: UnitAction }) =>
      api.post<BloodUnitView>(`/inventory/${id}/${action}`),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'release' ? 'Unit released' : 'Unit marked expired');
      setPendingAction(null);
      invalidate();
    },
    onError: (error) => toast.error('Action failed', getErrorMessage(error)),
  });

  const addUnit = useMutation({
    mutationFn: (payload: CreateUnitRequest) => api.post<BloodUnitView>('/inventory', payload),
    onSuccess: () => {
      toast.success('Blood unit created');
      setAddOpen(false);
      setNewUnit(emptyUnit(activeOrganizationId));
      setFormErrors({});
      invalidate();
    },
    onError: (error) => toast.error('Could not create unit', getErrorMessage(error)),
  });

  const adjustUnit = useMutation({
    mutationFn: (payload: InventoryAdjustmentRequest) => api.post('/inventory/adjustments', payload),
    onSuccess: () => {
      toast.success('Adjustment recorded');
      setAdjustment({ delta: '', reason: '', location: '' });
      invalidate();
    },
    onError: (error) => toast.error('Could not record adjustment', getErrorMessage(error)),
  });

  const clearFilters = () => {
    setSearch('');
    setBloodGroup('');
    setComponentType('');
    setStatus('');
    setExpiringWithinDays('');
    setPage(0);
  };

  const openDetail = (id: number) => {
    adjustUnit.reset();
    setSelectedId(id);
  };

  const openAdd = () => {
    addUnit.reset();
    setNewUnit(emptyUnit(activeOrganizationId));
    setFormErrors({});
    setAddOpen(true);
  };

  const serverUnits = inventoryQuery.data?.content ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const units = term
    ? serverUnits.filter((unit) =>
        `${unit.unitNumber} ${unit.publicId ?? ''} ${unit.storageLocation ?? ''}`
          .toLowerCase()
          .includes(term),
      )
    : serverUnits;
  const movements = movementsQuery.data ?? [];

  const renderActions = (unit: BloodUnitView) => (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDetail(unit.id)}>
        View
      </button>
      {auth.hasPermission(PERMISSIONS.INVENTORY_RELEASE) && unit.status !== 'EXPIRED' && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={unitAction.isPending || unit.released}
          onClick={() => {
            unitAction.reset();
            setPendingAction({ id: unit.id, unitNumber: unit.unitNumber, action: 'release' });
          }}
        >
          Release
        </button>
      )}
      {auth.hasPermission(PERMISSIONS.INVENTORY_WRITE) && unit.status !== 'EXPIRED' && (
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={unitAction.isPending}
          onClick={() => {
            unitAction.reset();
            setPendingAction({ id: unit.id, unitNumber: unit.unitNumber, action: 'expire' });
          }}
        >
          Expire
        </button>
      )}
    </>
  );

  const columns: DataTableColumn<BloodUnitView>[] = [
    {
      key: 'unitNumber',
      header: 'Unit',
      sortable: true,
      render: (unit) => (
        <div>
          <div className="table-cell-strong mono">{unit.unitNumber}</div>
          <div className="text-xs text-subtle">{unit.publicId}</div>
        </div>
      ),
    },
    {
      key: 'bloodGroup',
      header: 'Blood group',
      sortable: true,
      render: (unit) => <span className="chip">{humanize(unit.bloodGroup)}</span>,
    },
    {
      key: 'componentType',
      header: 'Component',
      sortable: true,
      render: (unit) => humanize(unit.componentType),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (unit) => <StatusBadge status={unit.status} />,
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      sortable: true,
      render: (unit) => {
        const days = daysUntil(unit.expiresAt);
        return (
          <div>
            <div>{formatDate(unit.expiresAt)}</div>
            {days !== null && days <= 7 && (
              <div className="text-xs text-warning" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CalendarClock size={12} aria-hidden="true" />
                {days < 0 ? 'Past expiry' : `${days} day${days === 1 ? '' : 's'} left`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'storageLocation',
      header: 'Location',
      sortable: true,
      render: (unit) => unit.storageLocation,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (unit) => (
        <div
          className="table-actions"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {renderActions(unit)}
        </div>
      ),
    },
  ];

  const submitNewUnit = () => {
    const errors: Record<string, string> = {};
    if (!newUnit.organizationId || newUnit.organizationId <= 0) errors.organizationId = 'Select an organization.';
    if (!newUnit.unitNumber.trim()) errors.unitNumber = 'Unit number is required.';
    if (!newUnit.collectedAt) errors.collectedAt = 'Collected at is required.';
    if (!newUnit.expiresAt) errors.expiresAt = 'Expiry is required.';
    if (newUnit.collectedAt && newUnit.expiresAt && new Date(newUnit.expiresAt) <= new Date(newUnit.collectedAt)) {
      errors.expiresAt = 'Expiry must be after collection.';
    }
    if (!newUnit.storageLocation.trim()) errors.storageLocation = 'Storage location is required.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    addUnit.mutate({
      ...newUnit,
      unitNumber: newUnit.unitNumber.trim(),
      storageLocation: newUnit.storageLocation.trim(),
      collectedAt: fromDateTimeLocal(newUnit.collectedAt) ?? newUnit.collectedAt,
      expiresAt: fromDateTimeLocal(String(newUnit.expiresAt)) ?? '',
    });
  };

  const detail = detailQuery.data;

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Operations"
        title="Blood inventory"
        description="Track blood units with API-backed filters, paging and audited lifecycle actions."
        actions={
          auth.hasPermission(PERMISSIONS.INVENTORY_WRITE) ? (
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} aria-hidden="true" /> Add unit
            </button>
          ) : undefined
        }
      />

      <section className="metric-grid page-enter stagger-1" aria-label="Inventory summary">
        <article className="metric-card surface">
          <span className="metric-label">Units on this page</span>
          <strong className="metric-value">{formatNumber(serverUnits.length)}</strong>
          <span className="metric-delta">
            of {formatNumber(inventoryQuery.data?.totalElements ?? 0)} returned by the API
          </span>
        </article>
        <article className="metric-card surface">
          <span className="metric-label">Expiring soon</span>
          <strong className="metric-value">{formatNumber(alertsQuery.data?.expiringSoon)}</strong>
          <span className="metric-delta">Within 7 days</span>
        </article>
        <article className="metric-card surface">
          <span className="metric-label">Expired units</span>
          <strong className="metric-value">{formatNumber(alertsQuery.data?.expired)}</strong>
          <span className="metric-delta">Needs review</span>
        </article>
        <article className="metric-card surface">
          <span className="metric-label">Low-stock organizations</span>
          <strong className="metric-value">{formatNumber(alertsQuery.data?.lowStockOrganizations)}</strong>
          <span className="metric-delta">From the alerts endpoint</span>
        </article>
      </section>

      <div className="toolbar surface-glass page-enter stagger-2">
        <span className="live-pill">
          <span className="live-dot" aria-hidden="true" /> Inventory view
        </span>
        <span className="freshness" role="status" aria-live="polite">
          {freshnessLabel(inventoryQuery.dataUpdatedAt, now)}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={inventoryQuery.isFetching}
          onClick={() => void inventoryQuery.refetch()}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {inventoryQuery.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {alertsQuery.data && (
        <section className="surface surface-raised" style={{ marginBottom: 'var(--space-4)' }} aria-label="Risk alerts">
          <div className="section-heading">
            <h2>Inventory alerts</h2>
            <span className="status-chip">API alerts</span>
          </div>
          <div className="cluster">
            <span className="badge badge-warning">Expiring within 7 days: {alertsQuery.data.expiringSoon}</span>
            <span className="badge badge-danger">Expired: {alertsQuery.data.expired}</span>
            <span className="badge badge-info">Low-stock organizations: {alertsQuery.data.lowStockOrganizations}</span>
          </div>
        </section>
      )}
      {alertsQuery.isError && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)' }} role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Alerts could not be loaded: {getErrorMessage(alertsQuery.error)}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void alertsQuery.refetch()}>
            Retry
          </button>
        </div>
      )}

      <DataTable
        ariaLabel="Blood unit inventory"
        caption="Blood units currently returned by the inventory API"
        loadingLabel="Loading blood units…"
        rowKey={(row) => row.id}
        columns={columns}
        rows={units}
        loading={inventoryQuery.isPending}
        page={inventoryQuery.data?.page ?? page}
        size={inventoryQuery.data?.size ?? PAGE_SIZE}
        totalElements={inventoryQuery.data?.totalElements}
        onPageChange={setPage}
        sort={sort}
        onSort={(key) =>
          setSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
          }))
        }
        onRowClick={(unit) => openDetail(unit.id)}
        emptyTitle="No blood units found"
        emptyDescription="Adjust the API filters, or add a unit if your role permits it."
        emptyAction={
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
            <RotateCcw size={14} aria-hidden="true" /> Clear filters
          </button>
        }
        mobileCard={(unit) => (
          <>
            <strong className="task-title mono">{unit.unitNumber}</strong>
            <dl className="mobile-card-fields">
              <div>
                <dt>Blood group</dt>
                <dd>{humanize(unit.bloodGroup)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={unit.status} />
                </dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{formatDate(unit.expiresAt)}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{unit.storageLocation}</dd>
              </div>
            </dl>
            <div className="action-row">{renderActions(unit)}</div>
          </>
        )}
        toolbar={
          <div className="surface-interactive" style={{ width: '100%' }}>
            <div className="filter-grid">
              <div className="filter-field">
                <label htmlFor="inventory-search">Unit search</label>
                <div className="search-input-wrap">
                  <Search size={15} aria-hidden="true" />
                  <input
                    id="inventory-search"
                    className="input toolbar-search"
                    type="search"
                    aria-describedby="inventory-search-note"
                    placeholder="Unit, public ID or location…"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <span className="text-xs text-subtle" id="inventory-search-note">
                  The API has no text search; this matches the current page only.
                </span>
              </div>
              <div className="filter-field">
                <label htmlFor="inventory-blood-group">Blood group</label>
                <select
                  id="inventory-blood-group"
                  className="select"
                  value={bloodGroup}
                  onChange={(event) => {
                    setBloodGroup(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All blood groups</option>
                  {BLOOD_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {humanize(group)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="inventory-component">Component</label>
                <select
                  id="inventory-component"
                  className="select"
                  value={componentType}
                  onChange={(event) => {
                    setComponentType(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All components</option>
                  {COMPONENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {humanize(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="inventory-status">Status</label>
                <select
                  id="inventory-status"
                  className="select"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All statuses</option>
                  {UNIT_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="inventory-expiring">Expiring within</label>
                <select
                  id="inventory-expiring"
                  className="select"
                  value={expiringWithinDays}
                  onChange={(event) => {
                    setExpiringWithinDays(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Any expiry</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>
              <div className="section-actions">
                <span className="chip">
                  <SlidersHorizontal size={12} aria-hidden="true" /> Server filters
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  <RotateCcw size={14} aria-hidden="true" /> Reset
                </button>
              </div>
            </div>
          </div>
        }
      />

      {inventoryQuery.isError && (
        <div className="surface" style={{ marginTop: 'var(--space-4)' }}>
          <ErrorState error={inventoryQuery.error} onRetry={() => void inventoryQuery.refetch()} />
        </div>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail ? `Unit ${detail.unitNumber}` : 'Unit detail'}
        description={detail ? `${humanize(detail.bloodGroup)} · ${humanize(detail.componentType)}` : undefined}
      >
        {detailQuery.isPending && (
          <div className="skeleton-lines" role="status" aria-live="polite">
            <Skeleton height={18} />
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
              <h3>Unit details</h3>
              <StatusBadge status={detail.status} label={detail.released ? `${humanize(detail.status)} · Released` : undefined} />
            </div>
            <dl className="detail-grid">
              <div className="detail-item">
                <dt>Public ID</dt>
                <dd className="mono">{detail.publicId}</dd>
              </div>
              <div className="detail-item">
                <dt>Collected</dt>
                <dd>{formatDateTime(detail.collectedAt)}</dd>
              </div>
              <div className="detail-item">
                <dt>Expires</dt>
                <dd>{formatDateTime(detail.expiresAt)}</dd>
              </div>
              <div className="detail-item">
                <dt>Location</dt>
                <dd>{detail.storageLocation}</dd>
              </div>
              <div className="detail-item">
                <dt>Organization</dt>
                <dd>{activeMembership?.organizationName ?? `Organization #${detail.organizationId}`}</dd>
              </div>
              <div className="detail-item">
                <dt>Donation</dt>
                <dd>{detail.donationId ?? '—'}</dd>
              </div>
              <div className="detail-item">
                <dt>Version</dt>
                <dd>{detail.version}</dd>
              </div>
            </dl>

            {auth.hasPermission(PERMISSIONS.INVENTORY_WRITE) && (
              <section className="surface surface-raised" style={{ marginTop: 16 }}>
                <div className="section-heading">
                  <h3>Record adjustment</h3>
                  <span className="status-chip">Audited</span>
                </div>
                <div className="form-grid">
                  <FormField label="Delta" hint="A negative value discards the unit" full>
                    <input
                      className="input"
                      type="number"
                      value={adjustment.delta}
                      onChange={(event) => setAdjustment({ ...adjustment, delta: event.target.value })}
                    />
                  </FormField>
                  <FormField label="Reason" required full>
                    <input
                      className="input"
                      value={adjustment.reason}
                      onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })}
                    />
                  </FormField>
                  <FormField label="New location" hint="Optional" full>
                    <input
                      className="input"
                      value={adjustment.location}
                      onChange={(event) => setAdjustment({ ...adjustment, location: event.target.value })}
                    />
                  </FormField>
                </div>
                {adjustUnit.isError && (
                  <div className="alert alert-danger" role="alert">
                    <AlertTriangle size={15} aria-hidden="true" />
                    <span>Could not record adjustment: {getErrorMessage(adjustUnit.error)}</span>
                  </div>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={adjustUnit.isPending || !adjustment.reason.trim()}
                    onClick={() =>
                      adjustUnit.mutate({
                        unitId: detail.id,
                        delta: adjustment.delta ? Number(adjustment.delta) : undefined,
                        reason: adjustment.reason.trim(),
                        location: adjustment.location.trim() || undefined,
                      })
                    }
                  >
                    {adjustUnit.isPending ? 'Saving adjustment…' : 'Save adjustment'}
                  </button>
                </div>
              </section>
            )}

            <section style={{ marginTop: 16 }}>
              <div className="section-heading">
                <h3>Movement history</h3>
                <span className="status-chip">{movements.length} events</span>
              </div>
              {movementsQuery.isPending && <Skeleton height={60} />}
              {movementsQuery.isError && (
                <ErrorState
                  error={movementsQuery.error}
                  title="Movement history could not be loaded"
                  onRetry={() => void movementsQuery.refetch()}
                />
              )}
              {movementsQuery.isSuccess && movements.length === 0 && (
                <EmptyState title="No movements recorded" description="Movements appear here as the unit progresses." />
              )}
              {movements.length > 0 && (
                <ol className="timeline timeline-list" style={{ marginTop: 16 }}>
                  {movements.map((movement, index) => (
                    <li key={movement.id ?? index}>
                      <strong>{[movement.fromStatus, movement.toStatus].filter(Boolean).join(' → ') || 'Movement'}</strong>
                      <div className="text-xs text-muted">{formatDateTime(movement.occurredAt)}</div>
                      {movement.reason && <p className="text-sm">{movement.reason}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </Drawer>

      <Modal
        open={pendingAction !== null}
        onClose={() => {
          if (!unitAction.isPending) setPendingAction(null);
        }}
        title={pendingAction?.action === 'release' ? 'Release blood unit' : 'Mark blood unit expired'}
        description="This action is sent immediately to the inventory API and is recorded in the audit log."
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={unitAction.isPending}
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={pendingAction?.action === 'release' ? 'btn btn-primary' : 'btn btn-danger'}
              disabled={unitAction.isPending || pendingAction === null}
              onClick={() => pendingAction && unitAction.mutate({ id: pendingAction.id, action: pendingAction.action })}
            >
              {unitAction.isPending
                ? pendingAction?.action === 'release'
                  ? 'Releasing…'
                  : 'Expiring…'
                : pendingAction?.action === 'release'
                  ? 'Confirm release'
                  : 'Confirm expiry'}
            </button>
          </>
        }
      >
        {pendingAction && (
          <div className="surface surface-raised">
            <p>
              Unit <strong className="mono">{pendingAction.unitNumber}</strong> will be{' '}
              {pendingAction.action === 'release'
                ? 'released for allocation.'
                : 'marked expired and removed from active inventory.'}
            </p>
            {unitAction.isError && (
              <div className="alert alert-danger" role="alert">
                <AlertTriangle size={15} aria-hidden="true" />
                <span>{getErrorMessage(unitAction.error)}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add blood unit"
        description="Link an existing account and create a unit through the inventory API."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={addUnit.isPending} onClick={submitNewUnit}>
              <Boxes size={15} aria-hidden="true" /> {addUnit.isPending ? 'Creating unit…' : 'Create unit'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          {canChooseOrganization ? (
            <FormField
              label="Organization"
              error={formErrors.organizationId}
              hint="Defaults to your active membership; you can choose another permitted organization."
              required
              full
            >
              <select
                className="select"
                value={newUnit.organizationId || ''}
                onChange={(event) => setNewUnit({ ...newUnit, organizationId: Number(event.target.value) })}
              >
                <option value="">Select an organization</option>
                {organizationOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : (
            <div className="form-field form-field-full">
              <label>Organization</label>
              <p className="text-sm text-muted">
                {activeMembership?.organizationName ?? `Organization #${activeOrganizationId ?? '—'}`}
              </p>
              <span className="field-hint">Using your active membership; organization selection is not available to this role.</span>
            </div>
          )}
          {canChooseOrganization && organizationsQuery.isPending && <Skeleton height={36} width="100%" />}
          {canChooseOrganization && organizationsQuery.isError && (
            <ErrorState
              error={organizationsQuery.error}
              title="Organizations could not be loaded"
              onRetry={() => void organizationsQuery.refetch()}
            />
          )}
          <FormField label="Unit number" error={formErrors.unitNumber} required full>
            <input
              className="input"
              value={newUnit.unitNumber}
              placeholder="e.g. LL-ABC-001"
              onChange={(event) => setNewUnit({ ...newUnit, unitNumber: event.target.value })}
            />
          </FormField>
          <FormField label="Blood group" required>
            <select
              className="select"
              value={newUnit.bloodGroup}
              onChange={(event) =>
                setNewUnit({ ...newUnit, bloodGroup: event.target.value as CreateUnitRequest['bloodGroup'] })
              }
            >
              {BLOOD_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {humanize(group)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Component" required>
            <select
              className="select"
              value={newUnit.componentType}
              onChange={(event) =>
                setNewUnit({ ...newUnit, componentType: event.target.value as CreateUnitRequest['componentType'] })
              }
            >
              {COMPONENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Collected at" error={formErrors.collectedAt} required>
            <input
              className="input"
              type="datetime-local"
              value={newUnit.collectedAt}
              onChange={(event) => setNewUnit({ ...newUnit, collectedAt: event.target.value })}
            />
          </FormField>
          <FormField label="Expires at" error={formErrors.expiresAt} hint="Required here for clarity" required>
            <input
              className="input"
              type="datetime-local"
              value={newUnit.expiresAt}
              onChange={(event) => setNewUnit({ ...newUnit, expiresAt: event.target.value })}
            />
          </FormField>
          <FormField label="Storage location" error={formErrors.storageLocation} required full>
            <input
              className="input"
              value={newUnit.storageLocation}
              placeholder="e.g. Cold room A / Rack 2"
              onChange={(event) => setNewUnit({ ...newUnit, storageLocation: event.target.value })}
            />
          </FormField>
        </div>
        {addUnit.isError && (
          <div className="alert alert-danger" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>Could not create unit: {getErrorMessage(addUnit.error)}</span>
          </div>
        )}
      </Modal>
    </div>
  );
}
