import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toChartData, toOverviewMetrics } from '@/lib/analytics';
import { BarChartView, EmptyState, ErrorState, LineChartView, PageHeader, PageSkeleton, PieChartView } from '@/components/ui';
import type { AnalyticsOverview } from '@/types/domain';
import { formatNumber } from '@/lib/utils';

export function AnalyticsPage() {
  const auth = useAuth();

  const overview = useQuery({
    queryKey: ['analytics', 'overview', 'page', auth.organizationId],
    queryFn: () => api.get<AnalyticsOverview>('/analytics/overview'),
  });
  const inventory = useQuery({
    queryKey: ['analytics', 'inventory', 'page', auth.organizationId],
    queryFn: () => api.get<unknown>('/analytics/inventory'),
  });
  const requests = useQuery({
    queryKey: ['analytics', 'requests', 'page', auth.organizationId],
    queryFn: () => api.get<unknown>('/analytics/requests'),
  });

  if (overview.isPending && inventory.isPending && requests.isPending) return <PageSkeleton />;

  const inventoryData = toChartData(inventory.data).slice(0, 10);
  const requestData = toChartData(requests.data).slice(0, 10);
  const metrics = toOverviewMetrics(overview.data, 5);

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Metrics are read directly from the analytics API and scoped to your account and organization."
      />

      <div className="kpi-grid">
        {metrics.map((metric) => (
          <article className="kpi-card" key={metric.label}>
            <div className="kpi-label"><BarChart3 size={14} aria-hidden="true" /> {metric.label}</div>
            <div className="kpi-value">{formatNumber(metric.value)}</div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="card" aria-labelledby="analytics-inventory-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="analytics-inventory-title">Inventory metrics</h2>
              <p className="card-subtitle">Response from /analytics/inventory</p>
            </div>
          </div>
          <div className="card-body">
            {inventory.isError && <ErrorState error={inventory.error} onRetry={() => void inventory.refetch()} />}
            {inventory.isPending && <PageSkeleton rows={3} />}
            {inventoryData.length === 0 && !inventory.isPending && !inventory.isError && (
              <EmptyState title="No inventory metrics" description="The API returned no grouped inventory values." />
            )}
            {inventoryData.length > 0 && <BarChartView data={inventoryData} ariaLabel="Inventory metrics chart" />}
          </div>
        </section>

        <section className="card" aria-labelledby="analytics-distribution-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="analytics-distribution-title">Distribution</h2>
              <p className="card-subtitle">Share of returned inventory groups</p>
            </div>
          </div>
          <div className="card-body">
            {inventoryData.length > 0 ? (
              <PieChartView data={inventoryData.slice(0, 6)} ariaLabel="Inventory group distribution" />
            ) : (
              <EmptyState title="No distribution to show" description="Grouped inventory data is required for this chart." />
            )}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 'var(--space-4)' }} aria-labelledby="analytics-requests-title">
        <div className="card-header">
          <div>
            <h2 className="card-title" id="analytics-requests-title">Request fulfilment metrics</h2>
            <p className="card-subtitle">Response from /analytics/requests</p>
          </div>
        </div>
        <div className="card-body">
          {requests.isError && <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />}
          {requests.isPending && <PageSkeleton rows={3} />}
          {requestData.length === 0 && !requests.isPending && !requests.isError && (
            <EmptyState title="No request metrics" description="The API returned no request fulfilment values." />
          )}
          {requestData.length > 0 && <LineChartView data={requestData} ariaLabel="Request fulfilment chart" />}
        </div>
      </section>
    </>
  );
}
