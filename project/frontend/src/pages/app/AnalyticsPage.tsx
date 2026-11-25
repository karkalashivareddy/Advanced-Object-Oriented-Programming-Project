import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Boxes, ClipboardList, Info, ShieldCheck } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { formatNumber, humanize } from '@/lib/utils';
import { BarChartView, type ChartDatum } from '@/components/ui/Charts';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { PageResponse } from '@/types/api';
import type { AnalyticsOverview, OrganizationView } from '@/types/domain';

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
    <div className="surface surface-raised chart-data-table-wrap">
      <table className="premium-table chart-data-table">
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
  const [platformScope, setPlatformScope] = useState<number | null>(null);

  const canReadAnalytics = auth.hasPermission(PERMISSIONS.ANALYTICS_READ);
  const isPlatformAdmin = auth.hasRole('PLATFORM_ADMIN');
  const analyticsScope = isPlatformAdmin ? platformScope : auth.organizationId;
  // `undefined` would make api.ts fall back to the stored active organization.
  // Passing null explicitly removes the header for the "All organizations" scope.
  const scopeOptions = { organizationId: analyticsScope };

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
  const metrics = overviewMetrics(overview.data, 6);
  const inventoryChartData = toChartData(inventoryMetrics.data);
  const requestChartData = toChartData(requestMetrics.data);

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
          <div className="metric-grid analytics-overview-metrics">
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
            <div className="metric-grid analytics-overview-metrics">
              {metrics.map((metric) => (
                <AnimatedMetric key={metric.label} metric={metric} reduced={reducedMotion} />
              ))}
            </div>
            <ChartTable caption="Overview metric values" data={metrics.map((metric) => ({ name: metric.label, value: metric.value }))} valueLabel="Value" />
          </>
        )}
      </section>

      <section className="chart-card surface" aria-labelledby="analytics-inventory-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow"><Boxes size={14} aria-hidden="true" /> Inventory</span>
              <h2 className="page-title" id="analytics-inventory-title">Available units by blood group</h2>
              <p className="page-subtitle">Complete organization-scoped totals are aggregated by the backend.</p>
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
          {inventoryChartData.length > 0 ? (
            <>
              <BarChartView data={inventoryChartData} ariaLabel="Available units by blood group chart" />
              <ChartTable caption="Available units by blood group" data={inventoryChartData} valueLabel="Units" />
            </>
          ) : (
            <EmptyState title="No available inventory" description="The backend returned no available units for this authorized scope." />
          )}
      </section>

      <section className="chart-card surface stagger-3" aria-labelledby="analytics-requests-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow"><ClipboardList size={14} aria-hidden="true" /> Requests</span>
            <h2 className="page-title" id="analytics-requests-title">Emergency requests by status</h2>
            <p className="page-subtitle">Complete organization-scoped status counts from the backend.</p>
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
        {requestChartData.length > 0 ? (
          <>
            <BarChartView data={requestChartData} ariaLabel="Emergency requests by status chart" />
            <ChartTable caption="Emergency request counts by status" data={requestChartData} valueLabel="Requests" />
          </>
        ) : (
          <EmptyState title="No emergency requests" description="The backend returned no requests for this authorized scope." />
        )}
      </section>

      <p className="freshness">
        <ShieldCheck size={13} aria-hidden="true" /> Each chart has one companion data table for exact values and keyboard access; separate views avoid repeating the same series.
      </p>
    </div>
  );
}
