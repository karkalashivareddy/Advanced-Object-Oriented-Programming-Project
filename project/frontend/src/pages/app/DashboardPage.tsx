import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  HeartHandshake,
  ScrollText,
  Users,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toChartData, toOverviewMetrics } from '@/lib/analytics';
import { PERMISSIONS } from '@/lib/permissions';
import { formatNumber, humanize } from '@/lib/utils';
import {
  BarChartView,
  EmptyState,
  ErrorState,
  LineChartView,
  PageHeader,
  PageSkeleton,
  StatusBadge,
} from '@/components/ui';
import { QUICK_ACTIONS } from '@/lib/navigation';
import type { AnalyticsOverview } from '@/types/domain';

export function DashboardPage() {
  const auth = useAuth();

  const overview = useQuery({
    queryKey: ['analytics', 'overview', auth.organizationId],
    queryFn: () => api.get<AnalyticsOverview>('/analytics/overview'),
  });

  const inventoryMetrics = useQuery({
    queryKey: ['analytics', 'inventory', auth.organizationId],
    queryFn: () => api.get<unknown>('/analytics/inventory'),
    enabled: auth.hasPermission(PERMISSIONS.INVENTORY_READ),
  });

  const requestMetrics = useQuery({
    queryKey: ['analytics', 'requests', auth.organizationId],
    queryFn: () => api.get<unknown>('/analytics/requests'),
    enabled: auth.hasPermission(PERMISSIONS.REQUEST_READ),
  });

  const metrics = toOverviewMetrics(overview.data);
  const inventoryData = toChartData(inventoryMetrics.data).slice(0, 8);
  const requestData = toChartData(requestMetrics.data).slice(0, 8);
  const isDonor = auth.hasRole('DONOR');

  if (overview.isPending) return <PageSkeleton />;

  if (overview.isError) {
    return (
      <>
        <PageHeader title="Dashboard" description="Your operational overview." />
        <div className="card">
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title={`Good to see you, ${auth.user?.fullName.split(' ')[0] ?? 'there'}`}
        description={
          auth.user?.memberships[0]
            ? `Here is the current picture for ${auth.user.memberships[0].organizationName}.`
            : 'Here is the current picture for your account.'
        }
        actions={
          <StatusBadge
            status={auth.user?.status}
            label={auth.user?.status === 'ACTIVE' ? 'Account active' : humanize(auth.user?.status)}
          />
        }
      />

      {metrics.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No summary metrics yet"
            description="The overview endpoint returned no metrics for this account. Operational pages below remain available."
          />
        </div>
      ) : (
        <div className="kpi-grid">
          {metrics.map((metric) => (
            <article className="kpi-card" key={metric.label}>
              <div className="kpi-label"><Activity size={14} aria-hidden="true" /> {metric.label}</div>
              <div className="kpi-value">{formatNumber(metric.value)}</div>
            </article>
          ))}
        </div>
      )}

      <div className="dashboard-grid">
        {auth.hasPermission(PERMISSIONS.INVENTORY_READ) && (
          <section className="card" aria-labelledby="inventory-overview-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="inventory-overview-title">Inventory composition</h2>
                <p className="card-subtitle">Grouped metrics returned by the analytics API.</p>
              </div>
              <Link className="btn btn-ghost btn-sm" to="/app/inventory">
                Open inventory <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="card-body">
              {inventoryMetrics.isPending && <PageSkeleton rows={3} />}
              {inventoryMetrics.isError && (
                <ErrorState error={inventoryMetrics.error} onRetry={() => void inventoryMetrics.refetch()} />
              )}
              {inventoryMetrics.isSuccess && inventoryData.length === 0 && (
                <EmptyState title="No grouped inventory data" description="No inventory groups were returned for your scope." />
              )}
              {inventoryData.length > 0 && (
                <BarChartView data={inventoryData} ariaLabel="Grouped inventory metrics" />
              )}
            </div>
          </section>
        )}

        <section className="card" aria-labelledby="quick-actions-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="quick-actions-title">Quick actions</h2>
              <p className="card-subtitle">Only actions available to your role are shown.</p>
            </div>
          </div>
          <div className="card-body">
            <div className="stack">
              {QUICK_ACTIONS.filter((action) => !action.rule || auth.canAccess(action.rule)).map((action) => (
                <Link className="workflow-card" key={action.to} to={action.to}>
                  <action.icon size={18} aria-hidden="true" />
                  <strong>{action.label}</strong>
                  <span>Open workspace</span>
                </Link>
              ))}
              {isDonor && (
                <>
                  <Link className="workflow-card" to="/app/donations">
                    <HeartHandshake size={18} aria-hidden="true" />
                    <strong>My donations</strong>
                    <span>Review donation records</span>
                  </Link>
                  <Link className="workflow-card" to="/app/donors">
                    <Users size={18} aria-hidden="true" />
                    <strong>Donor profile</strong>
                    <span>Consents and appointments</span>
                  </Link>
                </>
              )}
              {auth.hasPermission(PERMISSIONS.AUDIT_READ) && (
                <Link className="workflow-card" to="/app/audit">
                  <ScrollText size={18} aria-hidden="true" />
                  <strong>Audit log</strong>
                  <span>Review recorded actions</span>
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>

      {auth.hasPermission(PERMISSIONS.REQUEST_READ) && (
        <section className="card" style={{ marginTop: 'var(--space-4)' }} aria-labelledby="request-metrics-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="request-metrics-title">Request fulfilment</h2>
              <p className="card-subtitle">Metrics returned by the requests analytics endpoint.</p>
            </div>
            <Link className="btn btn-ghost btn-sm" to="/app/requests">
              <ClipboardList size={14} aria-hidden="true" /> View requests
            </Link>
          </div>
          <div className="card-body">
            {requestMetrics.isPending && <PageSkeleton rows={3} />}
            {requestMetrics.isError && (
              <ErrorState error={getErrorMessage(requestMetrics.error)} onRetry={() => void requestMetrics.refetch()} />
            )}
            {requestMetrics.isSuccess && requestData.length === 0 && (
              <EmptyState title="No request metrics" description="No fulfilment metrics were returned for your scope." />
            )}
            {requestData.length > 0 && <LineChartView data={requestData} ariaLabel="Request fulfilment metrics" />}
          </div>
        </section>
      )}

      {!isDonor && auth.hasPermission(PERMISSIONS.ANALYTICS_READ) && (
        <p className="text-xs text-subtle" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Boxes size={13} aria-hidden="true" /> Detailed metrics are available on the Analytics page.
        </p>
      )}
    </>
  );
}
