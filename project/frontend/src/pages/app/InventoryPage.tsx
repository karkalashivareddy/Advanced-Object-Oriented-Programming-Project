import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, CalendarClock, Plus, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { BLOOD_GROUPS, COMPONENT_TYPES, UNIT_STATUSES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { daysUntil, formatDate, formatDateTime, fromDateTimeLocal, humanize } from '@/lib/utils';
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
} from '@/types/domain';

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

export function InventoryPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
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

  // The inventory API exposes server-side filters but no search parameter.
  const inventoryQuery = useQuery({
    queryKey: ['inventory', bloodGroup, componentType, status, expiringWithinDays, page, sort, auth.organizationId],
    queryFn: () =>
      api.get<PageResponse<BloodUnitView>>('/inventory', {
        query: {
          bloodGroup: bloodGroup || undefined,
          componentType: componentType || undefined,
          status: status || undefined,
          expiringWithinDays: expiringWithinDays || undefined,
          organizationId: auth.organizationId ?? undefined,
          page,
          size: 20,
          sort: `${sort.key},${sort.direction}`,
        },
      }),
  });

  const alertsQuery = useQuery({
    queryKey: ['inventory', 'alerts'],
    queryFn: () => api.get<InventoryAlerts>('/inventory/alerts'),
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

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const unitAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'release' | 'expire' }) =>
      api.post<BloodUnitView>(`/inventory/${id}/${action}`),
    onSuccess: (_, variables) => {
      toast.success(`Unit ${variables.action === 'release' ? 'released' : 'marked expired'}`);
      invalidate();
    },
    onError: (error) => toast.error('Action failed', getErrorMessage(error)),
  });

  const addUnit = useMutation({
    mutationFn: (payload: CreateUnitRequest) => api.post<BloodUnitView>('/inventory', payload),
    onSuccess: () => {
      toast.success('Blood unit created');
      setAddOpen(false);
      setNewUnit(emptyUnit(auth.organizationId));
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

  const serverUnits = inventoryQuery.data?.content ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const units = term
    ? serverUnits.filter((unit) =>
        `${unit.unitNumber} ${unit.publicId ?? ''} ${unit.storageLocation ?? ''}`.toLowerCase().includes(term))
    : serverUnits;
  const movements = movementsQuery.data ?? [];

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
    { key: 'bloodGroup', header: 'Blood group', sortable: true, render: (unit) => <span className="chip">{humanize(unit.bloodGroup)}</span> },
    { key: 'componentType', header: 'Component', sortable: true, render: (unit) => humanize(unit.componentType) },
    { key: 'status', header: 'Status', sortable: true, render: (unit) => <StatusBadge status={unit.status} /> },
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
                <CalendarClock size={12} aria-hidden="true" /> {days < 0 ? 'Past expiry' : `${days} day${days === 1 ? '' : 's'} left`}
              </div>
            )}
          </div>
        );
      },
    },
    { key: 'storageLocation', header: 'Location', sortable: true, render: (unit) => unit.storageLocation },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (unit) => (
        <div className="table-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(unit.id)}>
            View
          </button>
          {auth.hasPermission(PERMISSIONS.INVENTORY_RELEASE) && unit.status !== 'EXPIRED' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={unitAction.isPending || unit.released}
              onClick={() => unitAction.mutate({ id: unit.id, action: 'release' })}
            >
              Release
            </button>
          )}
          {auth.hasPermission(PERMISSIONS.INVENTORY_WRITE) && unit.status !== 'EXPIRED' && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={unitAction.isPending}
              onClick={() => unitAction.mutate({ id: unit.id, action: 'expire' })}
            >
              Expire
            </button>
          )}
        </div>
      ),
    },
  ];

  const submitNewUnit = () => {
    const errors: Record<string, string> = {};
    if (!newUnit.organizationId) errors.organizationId = 'Select an organization.';
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
    <>
      <PageHeader
        eyebrow="Operations"
        title="Blood inventory"
        description="Search, filter, and act on blood units. All changes go through the inventory API."
        actions={
          auth.hasPermission(PERMISSIONS.INVENTORY_WRITE) ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setNewUnit(emptyUnit(auth.organizationId));
                setFormErrors({});
                setAddOpen(true);
              }}
            >
              <Plus size={16} aria-hidden="true" /> Add unit
            </button>
          ) : undefined
        }
      />

      {alertsQuery.data && (
        <div className="card card-pad" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="cluster" style={{ marginBottom: 8 }}>
            <AlertTriangle size={16} className="text-warning" aria-hidden="true" />
            <strong>Inventory alerts</strong>
            <span className="text-muted text-xs">Returned by the inventory API</span>
          </div>
          <div className="cluster">
            <span className="badge badge-warning">Expiring within 7 days: {alertsQuery.data.expiringSoon}</span>
            <span className="badge badge-danger">Expired: {alertsQuery.data.expired}</span>
            <span className="badge badge-info">Low-stock organizations: {alertsQuery.data.lowStockOrganizations}</span>
          </div>
        </div>
      )}
      {alertsQuery.isError && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)' }} role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Alerts could not be loaded: {getErrorMessage(alertsQuery.error)}</span>
        </div>
      )}

      <DataTable
        ariaLabel="Blood unit inventory"
        rowKey={(row) => row.id}
        columns={columns}
        rows={units}
        loading={inventoryQuery.isPending}
        page={inventoryQuery.data?.page ?? page}
        size={inventoryQuery.data?.size ?? 20}
        totalElements={inventoryQuery.data?.totalElements}
        onPageChange={setPage}
        sort={sort}
        onSort={(key) =>
          setSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
          }))
        }
        onRowClick={(unit) => setSelectedId(unit.id)}
        emptyTitle="No blood units found"
        emptyDescription="Adjust the filters, or add a unit if your role permits it."
        emptyAction={
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
            <RotateCcw size={14} aria-hidden="true" /> Clear filters
          </button>
        }
        toolbar={
          <>
            <div className="table-toolbar-filters">
              <div className="search-input-wrap">
                <Search size={15} aria-hidden="true" />
                <input
                  className="input"
                  type="search"
                  aria-label="Search units by number or location"
                  placeholder="Search unit number…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <label className="sr-only" htmlFor="inventory-blood-group">Blood group</label>
              <select id="inventory-blood-group" className="select" value={bloodGroup} onChange={(event) => { setBloodGroup(event.target.value); setPage(0); }}>
                <option value="">All blood groups</option>
                {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{humanize(group)}</option>)}
              </select>
              <label className="sr-only" htmlFor="inventory-component">Component</label>
              <select id="inventory-component" className="select" value={componentType} onChange={(event) => { setComponentType(event.target.value); setPage(0); }}>
                <option value="">All components</option>
                {COMPONENT_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
              </select>
              <label className="sr-only" htmlFor="inventory-status">Status</label>
              <select id="inventory-status" className="select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}>
                <option value="">All statuses</option>
                {UNIT_STATUSES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
              </select>
              <label className="sr-only" htmlFor="inventory-expiring">Expiring within</label>
              <select id="inventory-expiring" className="select" value={expiringWithinDays} onChange={(event) => { setExpiringWithinDays(event.target.value); setPage(0); }}>
                <option value="">Any expiry</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
            <span className="chip"><SlidersHorizontal size={12} aria-hidden="true" /> API filters</span>
          </>
        }
      />

      {inventoryQuery.isError && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <ErrorState error={inventoryQuery.error} onRetry={() => void inventoryQuery.refetch()} />
        </div>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail ? `Unit ${detail.unitNumber}` : 'Unit detail'}
        description={detail ? `${humanize(detail.bloodGroup)} · ${humanize(detail.componentType)}` : undefined}
      >
        {detailQuery.isPending && <div className="skeleton-lines"><Skeleton height={18} /><Skeleton height={18} /><Skeleton height={18} /></div>}
        {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />}
        {detail && (
          <>
            <dl className="detail-grid">
              <div className="detail-item"><dt>Status</dt><dd><StatusBadge status={detail.status} /> {detail.released ? '· Released' : ''}</dd></div>
              <div className="detail-item"><dt>Public ID</dt><dd className="mono">{detail.publicId}</dd></div>
              <div className="detail-item"><dt>Collected</dt><dd>{formatDateTime(detail.collectedAt)}</dd></div>
              <div className="detail-item"><dt>Expires</dt><dd>{formatDateTime(detail.expiresAt)}</dd></div>
              <div className="detail-item"><dt>Location</dt><dd>{detail.storageLocation}</dd></div>
              <div className="detail-item"><dt>Organization</dt><dd>{detail.organizationId}</dd></div>
              <div className="detail-item"><dt>Donation</dt><dd>{detail.donationId ?? '—'}</dd></div>
              <div className="detail-item"><dt>Version</dt><dd>{detail.version}</dd></div>
            </dl>

            {auth.hasPermission(PERMISSIONS.INVENTORY_WRITE) && (
              <>
                <hr className="divider" />
                <h3>Record adjustment</h3>
                <div className="inline-form" style={{ marginTop: 12 }}>
                  <FormField label="Delta" hint="A negative value discards the unit" full>
                    <input className="input" type="number" value={adjustment.delta} onChange={(event) => setAdjustment({ ...adjustment, delta: event.target.value })} />
                  </FormField>
                  <FormField label="Reason" required full>
                    <input className="input" value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} />
                  </FormField>
                  <FormField label="New location" hint="Optional" full>
                    <input className="input" value={adjustment.location} onChange={(event) => setAdjustment({ ...adjustment, location: event.target.value })} />
                  </FormField>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={adjustUnit.isPending || !adjustment.reason.trim()}
                    onClick={() => adjustUnit.mutate({
                      unitId: detail.id,
                      delta: adjustment.delta ? Number(adjustment.delta) : undefined,
                      reason: adjustment.reason.trim(),
                      location: adjustment.location.trim() || undefined,
                    })}
                  >
                    Save adjustment
                  </button>
                </div>
              </>
            )}

            <hr className="divider" />
            <h3>Movement history</h3>
            {movementsQuery.isPending && <Skeleton height={60} />}
            {movementsQuery.isError && <ErrorState error={movementsQuery.error} />}
            {movementsQuery.isSuccess && movements.length === 0 && (
              <EmptyState title="No movements recorded" description="Movements appear here as the unit progresses." />
            )}
            {movements.length > 0 && (
              <ol className="timeline" style={{ marginTop: 16 }}>
                {movements.map((movement, index) => (
                  <li key={movement.id ?? index}>
                    <strong>{[movement.fromStatus, movement.toStatus].filter(Boolean).join(' → ') || 'Movement'}</strong>
                    <div className="text-xs text-muted">{formatDateTime(movement.occurredAt)}</div>
                    {movement.reason && <p className="text-sm">{movement.reason}</p>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add blood unit"
        description="Create a unit through the inventory API."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={addUnit.isPending} onClick={submitNewUnit}>
              <Boxes size={15} aria-hidden="true" /> Create unit
            </button>
          </>
        }
      >
        <div className="form-grid">
          <FormField label="Organization" error={formErrors.organizationId} hint="ID of the organization that owns the unit" required full>
            <input
              className="input"
              inputMode="numeric"
              value={newUnit.organizationId || ''}
              onChange={(event) => setNewUnit({ ...newUnit, organizationId: Number(event.target.value) })}
            />
          </FormField>
          <FormField label="Unit number" error={formErrors.unitNumber} required full>
            <input
              className="input"
              value={newUnit.unitNumber}
              placeholder="e.g. LL-ABC-001"
              onChange={(event) => setNewUnit({ ...newUnit, unitNumber: event.target.value })}
            />
          </FormField>
          <FormField label="Blood group" required>
            <select className="select" value={newUnit.bloodGroup} onChange={(event) => setNewUnit({ ...newUnit, bloodGroup: event.target.value as CreateUnitRequest['bloodGroup'] })}>
              {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{humanize(group)}</option>)}
            </select>
          </FormField>
          <FormField label="Component" required>
            <select className="select" value={newUnit.componentType} onChange={(event) => setNewUnit({ ...newUnit, componentType: event.target.value as CreateUnitRequest['componentType'] })}>
              {COMPONENT_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
            </select>
          </FormField>
          <FormField label="Collected at" error={formErrors.collectedAt} required>
            <input className="input" type="datetime-local" value={newUnit.collectedAt} onChange={(event) => setNewUnit({ ...newUnit, collectedAt: event.target.value })} />
          </FormField>
          <FormField label="Expires at" error={formErrors.expiresAt} hint="Optional in the API; required here for clarity" required>
            <input className="input" type="datetime-local" value={newUnit.expiresAt} onChange={(event) => setNewUnit({ ...newUnit, expiresAt: event.target.value })} />
          </FormField>
          <FormField label="Storage location" error={formErrors.storageLocation} required full>
            <input className="input" value={newUnit.storageLocation} placeholder="e.g. Cold room A / Rack 2" onChange={(event) => setNewUnit({ ...newUnit, storageLocation: event.target.value })} />
          </FormField>
        </div>
      </Modal>
    </>
  );
}
