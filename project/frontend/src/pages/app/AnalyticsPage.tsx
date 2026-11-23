import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Boxes, ClipboardList, Info, PieChart as PieChartIcon, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BLOOD_GROUPS, COMPONENT_TYPES, REQUEST_STATUSES, UNIT_STATUSES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { formatNumber, humanize } from '@/lib/utils';
import { BarChartView, LineChartView, PieChartView, type ChartDatum } from '@/components/ui/Charts';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { PageResponse } from '@/types/api';
import type { AnalyticsOverview, BloodUnitView, EmergencyRequestView, OrganizationView } from '@/types/domain';

const NAME_KEYS = ['name', 'label', 'bloodGroup', 'componentType', 'status', 'type', 'urgency'];
const VALUE_KEYS = ['value', 'count', 'total', 'quantity', 'units', 'amount'];

interface OverviewMetric {
  label: string;
  value: number;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function overviewMetrics(source: AnalyticsOverview | undefined, limit = 6): OverviewMetric[] {
  if (!source) return [];
  const flattened: Record<string, unknown> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (finiteNumber(value) !== null) flattened[key] = value;
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value as Record<string, unknown>).forEach(([nestedKey, nestedValue]) => {
        if (finiteNumber(nestedValue) !== null) flattened[nestedKey] = nestedValue;
      });
    }
  });
  return Object.entries(flattened)
    .slice(0, limit)
    .map(([label, value]) => ({ label: humanize(label), value: finiteNumber(value) ?? 0 }));
}

function toChartData(source: unknown): ChartDatum[] {
  if (Array.isArray(source)) {
    return source
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const nameKey = NAME_KEYS.find((key) => record[key] !== undefined);
        const valueKey = VALUE_KEYS.find((key) => finiteNumber(record[key]) !== null);
        if (!nameKey || !valueKey) return null;
        return { name: humanize(String(record[nameKey])), value: finiteNumber(record[valueKey]) ?? 0 };
      })
      .filter((entry): entry is ChartDatum => entry !== null);
  }
  if (source && typeof source === 'object') {
    return Object.entries(source as Record<string, unknown>)
      .map(([key, value]) => ({ name: humanize(key), value: finiteNumber(value) }))
      .filter((entry): entry is ChartDatum => entry.value !== null);
  }
  return [];
}

function countBy<T>(items: T[], keyFor: (item: T) => string): ChartDatum[] {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const name = humanize(keyFor(item));
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return Array.from(counts, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value || a.name.localeCompare(b.name),
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

function AnimatedMetric({ metric, reduced }: { metric: OverviewMetric; reduced: boolean }) {
  const [displayed, setDisplayed] = useState(reduced ? metric.value : 0);

  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== 'function') {
      setDisplayed(metric.value);
      return;
    }
    let frame = 0;
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const duration = 650;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(metric.value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [metric.value, reduced]);

  return (
    <article className="metric-card">
      <span className="metric-label">{metric.label}</span>
      <strong className="metric-value">{formatNumber(displayed)}</strong>
      <span className="metric-delta">Analytics API</span>
    </article>
  );
}

function ChartTable({ caption, data, valueLabel }: { caption: string; data: ChartDatum[]; valueLabel: string }) {
  return (
    <div className="surface surface-raised">
      <table className="premium-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={2}>No values returned for this selection.</td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                <td>{formatNumber(row.value)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AnalyticsPage() {
  const auth = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [bloodGroup, setBloodGroup] = useState('ALL');
  const [componentType, setComponentType] = useState('ALL');
  const [unitStatus, setUnitStatus] = useState('ALL');
  const [requestStatus, setRequestStatus] = useState('ALL');
  const [platformScope, setPlatformScope] = useState<number | null>(null);

  const canReadAnalytics = auth.hasPermission(PERMISSIONS.ANALYTICS_READ);
  const isPlatformAdmin = auth.hasRole('PLATFORM_ADMIN');
  const analyticsScope = isPlatformAdmin ? platformScope : auth.organizationId;
  const scopeOptions = analyticsScope === null ? undefined : { organizationId: analyticsScope };
  const canReadInventory = auth.hasPermission(PERMISSIONS.INVENTORY_READ);
  const canReadRequests = auth.hasPermission(PERMISSIONS.REQUEST_READ);

  const organizationOptions = useQuery({
    queryKey: ['organizations', 'analytics-scope-options'],
    queryFn: () => api.get<PageResponse<OrganizationView>>('/organizations', { query: { page: 0, size: 200 } }),
    enabled: canReadAnalytics && isPlatformAdmin,
  });
  const overview = useQuery({
    queryKey: ['analytics', 'overview', 'page', analyticsScope],
    queryFn: () => api.get<AnalyticsOverview>('/analytics/overview', scopeOptions),
    enabled: canReadAnalytics,
  });
  const inventoryMetrics = useQuery({
    queryKey: ['analytics', 'inventory', 'page', analyticsScope],
    queryFn: () => api.get<unknown>('/analytics/inventory', scopeOptions),
    enabled: canReadAnalytics,
  });
  const requestMetrics = useQuery({
    queryKey: ['analytics', 'requests', 'page', analyticsScope],
    queryFn: () => api.get<unknown>('/analytics/requests', scopeOptions),
    enabled: canReadAnalytics,
  });
  const inventoryUnits = useQuery({
    queryKey: ['analytics', 'raw-inventory', analyticsScope],
    queryFn: () => api.get<PageResponse<BloodUnitView>>('/inventory', {
      ...scopeOptions,
      query: { page: 0, size: 200 },
    }),
    enabled: canReadAnalytics && canReadInventory,
  });
  const requestRecords = useQuery({
    queryKey: ['analytics', 'raw-requests', analyticsScope],
    queryFn: () => api.get<EmergencyRequestView[]>('/emergency-requests', scopeOptions),
    enabled: canReadAnalytics && canReadRequests,
  });

  const metrics = overviewMetrics(overview.data, 6);
  const groupedInventory = toChartData(inventoryMetrics.data);
  const groupedRequests = toChartData(requestMetrics.data);

  const rawUnits = inventoryUnits.data?.content ?? [];
  const filteredUnits = rawUnits.filter(
    (unit) =>
      (bloodGroup === 'ALL' || unit.bloodGroup === bloodGroup) &&
      (componentType === 'ALL' || unit.componentType === componentType) &&
      (unitStatus === 'ALL' || unit.status === unitStatus),
  );
  const filteredRequests = (requestRecords.data ?? []).filter(
    (request) => requestStatus === 'ALL' || request.status.toUpperCase() === requestStatus,
  );

  const inventoryChartData = useMemo(() => {
    if (canReadInventory && inventoryUnits.isSuccess) return countBy(filteredUnits, (unit) => unit.bloodGroup);
    return groupedInventory;
  }, [canReadInventory, filteredUnits, groupedInventory, inventoryUnits.isSuccess]);

  const requestChartData = useMemo(() => {
    if (canReadRequests && requestRecords.isSuccess) return countBy(filteredRequests, (request) => request.status);
    return groupedRequests;
  }, [canReadRequests, filteredRequests, groupedRequests, requestRecords.isSuccess]);

  const inventorySource = canReadInventory && inventoryUnits.isSuccess ? 'Client-side filters over returned inventory units' : 'API grouped inventory totals';
  const requestSource = canReadRequests && requestRecords.isSuccess ? 'Client-side filters over returned request records' : 'API grouped request totals';
  const hasFilters = bloodGroup !== 'ALL' || componentType !== 'ALL' || unitStatus !== 'ALL' || requestStatus !== 'ALL';

  const resetFilters = () => {
    setBloodGroup('ALL');
    setComponentType('ALL');
    setUnitStatus('ALL');
    setRequestStatus('ALL');
  };

  return (
    <div className="app-page page-enter">
      <header className="page-intro">
        <div>
          <span className="eyebrow"><BarChart3 size={14} aria-hidden="true" /> Insights</span>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">
            Metrics are read directly from the analytics API and scoped to your account and organization.
          </p>
        </div>
        <div className="section-actions">
          {isPlatformAdmin && canReadAnalytics && (
            <div className="filter-field analytics-scope-control">
              <label htmlFor="analytics-organization-scope">Organization scope</label>
              <select
                id="analytics-organization-scope"
                className="input"
                value={platformScope ?? ''}
                onChange={(event) => setPlatformScope(
                  event.target.value === '' ? null : Number(event.target.value),
                )}
              >
                <option value="">All organizations</option>
                {(organizationOptions.data?.content ?? []).map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </select>
            </div>
          )}
          <span className="live-pill"><span className="live-dot" aria-hidden="true" /> Read-only view</span>
          <span className="freshness">No export is performed</span>
        </div>
      </header>

      {!canReadAnalytics && (
        <div className="surface">
          <EmptyState
            title="Analytics needs ANALYTICS_READ"
            description="Your account does not have access to the analytics endpoints. Other workspace pages remain available."
            action={<a className="btn btn-secondary" href="#main-content">Back to top</a>}
          />
        </div>
      )}

      <section className="surface surface-glass stagger-1" aria-labelledby="overview-metrics-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Overview</span>
            <h2 className="page-title" id="overview-metrics-title">Counts from /analytics/overview</h2>
            <p className="page-subtitle">Animated where motion is allowed; values are never invented.</p>
          </div>
        </div>
        {canReadAnalytics && overview.isPending && (
          <div className="metric-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <article className="metric-card" key={index}>
                <Skeleton width="60%" />
                <Skeleton width="40%" height={28} />
              </article>
            ))}
          </div>
        )}
        {canReadAnalytics && overview.isError && (
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        )}
        {canReadAnalytics && overview.isSuccess && metrics.length === 0 && (
          <EmptyState title="No overview metrics" description="The endpoint returned no numeric values for this scope." />
        )}
        {metrics.length > 0 && (
          <>
            <div className="metric-grid">
              {metrics.map((metric) => (
                <AnimatedMetric key={metric.label} metric={metric} reduced={reducedMotion} />
              ))}
            </div>
            <ChartTable caption="Overview metric values" data={metrics.map((metric) => ({ name: metric.label, value: metric.value }))} valueLabel="Value" />
          </>
        )}
      </section>

      <section className="surface surface-raised stagger-2" aria-labelledby="analytics-filters-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow"><SlidersHorizontal size={14} aria-hidden="true" /> Client-side filters</span>
            <h2 className="page-title" id="analytics-filters-title">Refine the returned records</h2>
            <p className="page-subtitle">
              These filters change the charts and tables below in your browser. They do not recalculate server analytics totals.
            </p>
          </div>
          <div className="section-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters} disabled={!hasFilters}>
              Reset filters
            </button>
          </div>
        </div>
        <div className="filter-grid">
          <div className="filter-field">
            <label htmlFor="analytics-blood-group">Blood group</label>
            <select
              id="analytics-blood-group"
              className="input"
              value={bloodGroup}
              onChange={(event) => setBloodGroup(event.target.value)}
              disabled={!inventoryUnits.isSuccess}
            >
              <option value="ALL">All returned groups</option>
              {BLOOD_GROUPS.map((group) => (
                <option key={group} value={group}>{humanize(group)}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="analytics-component">Component</label>
            <select
              id="analytics-component"
              className="input"
              value={componentType}
              onChange={(event) => setComponentType(event.target.value)}
              disabled={!inventoryUnits.isSuccess}
            >
              <option value="ALL">All components</option>
              {COMPONENT_TYPES.map((component) => (
                <option key={component} value={component}>{humanize(component)}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="analytics-unit-status">Unit status</label>
            <select
              id="analytics-unit-status"
              className="input"
              value={unitStatus}
              onChange={(event) => setUnitStatus(event.target.value)}
              disabled={!inventoryUnits.isSuccess}
            >
              <option value="ALL">All unit statuses</option>
              {UNIT_STATUSES.map((status) => (
                <option key={status} value={status}>{humanize(status)}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="analytics-request-status">Request status</label>
            <select
              id="analytics-request-status"
              className="input"
              value={requestStatus}
              onChange={(event) => setRequestStatus(event.target.value)}
              disabled={!requestRecords.isSuccess}
            >
              <option value="ALL">All request statuses</option>
              {REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>{humanize(status)}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="freshness">
          {inventoryUnits.isSuccess
            ? `${filteredUnits.length} of ${rawUnits.length} returned inventory units in view.`
            : 'Raw inventory filtering requires INVENTORY_READ and a successful inventory response.'}
          {' '}
          {requestRecords.isSuccess
            ? `${filteredRequests.length} of ${requestRecords.data?.length ?? 0} returned requests in view.`
            : 'Request filtering requires REQUEST_READ and a successful request response.'}
        </p>
      </section>

      <div className="split-layout">
        <section className="chart-card surface" aria-labelledby="analytics-inventory-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow"><Boxes size={14} aria-hidden="true" /> Inventory</span>
              <h2 className="page-title" id="analytics-inventory-title">Inventory composition</h2>
              <p className="page-subtitle">{inventorySource}</p>
            </div>
          </div>
          {canReadAnalytics && inventoryMetrics.isPending && <Skeleton height={180} />}
          {canReadAnalytics && inventoryMetrics.isError && (
            <div className="alert alert-warning">
              <Info size={16} aria-hidden="true" />
              <div>
                <strong>Grouped API totals could not load</strong>
                {getErrorMessage(inventoryMetrics.error)}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void inventoryMetrics.refetch()}>
                  Retry grouped totals
                </button>
              </div>
            </div>
          )}
          {canReadAnalytics && canReadInventory && inventoryUnits.isPending && <Skeleton height={180} />}
          {canReadAnalytics && canReadInventory && inventoryUnits.isError && (
            <ErrorState error={inventoryUnits.error} onRetry={() => void inventoryUnits.refetch()} />
          )}
          {inventoryChartData.length > 0 ? (
            <>
              <BarChartView data={inventoryChartData} ariaLabel="Inventory composition chart" />
              <ChartTable caption="Inventory composition values" data={inventoryChartData} valueLabel="Units" />
            </>
          ) : (
            <EmptyState title="No inventory values" description="No grouped or returned inventory records are available for this selection." />
          )}
        </section>

        <section className="chart-card surface" aria-labelledby="analytics-distribution-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow"><PieChartIcon size={14} aria-hidden="true" /> Share</span>
              <h2 className="page-title" id="analytics-distribution-title">Distribution</h2>
              <p className="page-subtitle">Share of the same grouped inventory values shown beside the chart.</p>
            </div>
          </div>
          {inventoryChartData.length > 0 ? (
            <>
              <PieChartView data={inventoryChartData.slice(0, 6)} ariaLabel="Inventory group distribution chart" />
              <ChartTable caption="Distribution values" data={inventoryChartData.slice(0, 6)} valueLabel="Units" />
            </>
          ) : (
            <EmptyState title="No distribution to show" description="Grouped inventory data is required for this chart." />
          )}
        </section>
      </div>

      <section className="chart-card surface stagger-3" aria-labelledby="analytics-requests-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow"><ClipboardList size={14} aria-hidden="true" /> Requests</span>
            <h2 className="page-title" id="analytics-requests-title">Request fulfilment metrics</h2>
            <p className="page-subtitle">{requestSource}</p>
          </div>
        </div>
        {canReadAnalytics && requestMetrics.isPending && <Skeleton height={180} />}
        {canReadAnalytics && requestMetrics.isError && (
          <div className="alert alert-warning">
            <Info size={16} aria-hidden="true" />
            <div>
              <strong>Grouped API totals could not load</strong>
              {getErrorMessage(requestMetrics.error)}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void requestMetrics.refetch()}>
                Retry grouped totals
              </button>
            </div>
          </div>
        )}
        {canReadAnalytics && canReadRequests && requestRecords.isPending && <Skeleton height={180} />}
        {canReadAnalytics && canReadRequests && requestRecords.isError && (
          <ErrorState error={requestRecords.error} onRetry={() => void requestRecords.refetch()} />
        )}
        {requestChartData.length > 0 ? (
          <>
            <LineChartView data={requestChartData} ariaLabel="Request fulfilment chart" />
            <ChartTable caption="Request fulfilment values" data={requestChartData} valueLabel="Requests" />
          </>
        ) : (
          <EmptyState title="No request metrics" description="No request fulfilment values are available for this selection." />
        )}
      </section>

      <p className="freshness">
        <ShieldCheck size={13} aria-hidden="true" /> Charts are visual aids; the adjacent tables carry the same exact values for screen readers and keyboard users.
      </p>
    </div>
  );
}
