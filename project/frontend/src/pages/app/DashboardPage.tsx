import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  HeartHandshake,
  LayoutDashboard,
  PackageCheck,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  TicketCheck,
  Truck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { organizationNameForScope } from '@/lib/organization';
import { QUICK_ACTIONS } from '@/lib/navigation';
import { daysUntil, formatDate, formatDateTime, formatNumber, humanize } from '@/lib/utils';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { PageResponse } from '@/types/api';
import type {
  AnalyticsOverview,
  AppointmentView,
  BloodUnitView,
  DispatchView,
  DonationView,
  DonorView,
  EmergencyRequestView,
  ReservationView,
} from '@/types/domain';

interface RefreshableQuery {
  refetch: () => Promise<unknown>;
  isFetching: boolean;
  dataUpdatedAt: number;
  isError: boolean;
}

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

type QueueState = 'loading' | 'error' | 'ready';

interface TaskCardProps {
  icon: LucideIcon;
  title: string;
  count: number;
  meta: string;
  to: string;
  items: string[];
  state: QueueState;
  error?: unknown;
  onRetry?: () => void;
}

function formatRelative(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function queueState(query: { isPending: boolean; isError: boolean }): QueueState {
  if (query.isPending) return 'loading';
  if (query.isError) return 'error';
  return 'ready';
}

function TaskCard({ icon: Icon, title, count, meta, to, items, state, error, onRetry }: TaskCardProps) {
  return (
    <article className="task-card surface surface-interactive">
      <div className="task-icon">
        <Icon size={19} aria-hidden="true" />
      </div>
      <h3 className="task-title">{title}</h3>
      <span className="metric-value">{formatNumber(count)}</span>
      <p className="task-meta">{meta}</p>
      {state === 'loading' && (
        <div className="stack">
          <Skeleton width="85%" />
          <Skeleton width="65%" />
        </div>
      )}
      {state === 'error' && (
        <div>
          <p className="field-error">{getErrorMessage(error)}</p>
          {onRetry && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
              <RefreshCw size={13} aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      )}
      {state === 'ready' && items.length > 0 && (
        <ul className="timeline-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {state === 'ready' && items.length === 0 && <p className="freshness">Nothing needs attention here.</p>}
      <Link className="task-cta" to={to}>
        Open queue <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </article>
  );
}

export function DashboardPage() {
  const auth = useAuth();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const canAnalytics = auth.hasPermission(PERMISSIONS.ANALYTICS_READ);
  const canInventory = auth.hasPermission(PERMISSIONS.INVENTORY_READ);
  const canRequests = auth.hasPermission(PERMISSIONS.REQUEST_READ);
  const canApproveRequests = auth.hasPermission(PERMISSIONS.REQUEST_APPROVE);
  const canDispatch = auth.hasPermission(PERMISSIONS.DISPATCH_READ);
  const canReservations = auth.hasPermission(PERMISSIONS.RESERVATION_READ);
  const canDonors = auth.hasPermission(PERMISSIONS.DONOR_READ);
  const canReviewDonations =
    auth.hasPermission(PERMISSIONS.SCREENING_REVIEW) || auth.hasPermission(PERMISSIONS.DONATION_APPROVE);

  const showDonorHome = auth.hasRole('DONOR');
  const showStaffHome =
    !showDonorHome || canAnalytics || canInventory || canRequests || canApproveRequests || canDispatch || canReservations || canReviewDonations;

  const overview = useQuery({
    queryKey: ['dashboard', 'analytics', 'overview', auth.organizationId],
    queryFn: () => api.get<AnalyticsOverview>('/analytics/overview'),
    enabled: canAnalytics,
  });

  const expiringInventory = useQuery({
    queryKey: ['dashboard', 'inventory', 'expiring', auth.organizationId],
    queryFn: () =>
      api.get<PageResponse<BloodUnitView>>('/inventory', {
        query: { expiringWithinDays: 7, page: 0, size: 5, sort: 'expiresAt,asc' },
      }),
    enabled: showStaffHome && canInventory,
  });

  const pendingRequests = useQuery({
    queryKey: ['dashboard', 'requests', 'pending', auth.organizationId],
    queryFn: () => api.get<EmergencyRequestView[]>('/emergency-requests', { query: { status: 'PENDING_VERIFICATION' } }),
    enabled: showStaffHome && canRequests,
  });

  const dispatches = useQuery({
    queryKey: ['dashboard', 'dispatches', auth.organizationId],
    queryFn: () => api.get<DispatchView[]>('/dispatches'),
    enabled: showStaffHome && canDispatch,
  });

  const reservations = useQuery({
    queryKey: ['dashboard', 'reservations', auth.organizationId],
    queryFn: () => api.get<ReservationView[]>('/reservations'),
    enabled: showStaffHome && canReservations,
  });

  const reviewDonations = useQuery({
    queryKey: ['dashboard', 'donations', 'review', auth.organizationId],
    queryFn: () => api.get<DonationView[]>('/donations'),
    enabled: showStaffHome && canReviewDonations,
  });

  const donorProfiles = useQuery({
    queryKey: ['dashboard', 'donors', 'self', auth.user?.id],
    queryFn: () => api.get<DonorView[]>('/donors'),
    enabled: showDonorHome && canDonors,
  });

  // Never fall back to an unrelated donor profile: that would request another
  // person's appointments and donations for this signed-in user.
  const donorId = donorProfiles.data?.find((profile) => profile.userId === auth.user?.id)?.id ?? null;

  const donorAppointments = useQuery({
    queryKey: ['dashboard', 'donors', donorId, 'appointments'],
    queryFn: () => api.get<AppointmentView[]>(`/donors/${donorId}/appointments`),
    enabled: showDonorHome && donorId !== null,
  });

  const donorDonations = useQuery({
    queryKey: ['dashboard', 'donors', donorId, 'donations'],
    queryFn: () => api.get<DonationView[]>('/donations', { query: { donorId } }),
    enabled: showDonorHome && donorId !== null,
  });

  const refreshTargets: RefreshableQuery[] = [];
  if (canAnalytics) refreshTargets.push(overview);
  if (showStaffHome && canInventory) refreshTargets.push(expiringInventory);
  if (showStaffHome && canRequests) refreshTargets.push(pendingRequests);
  if (showStaffHome && canDispatch) refreshTargets.push(dispatches);
  if (showStaffHome && canReservations) refreshTargets.push(reservations);
  if (showStaffHome && canReviewDonations) refreshTargets.push(reviewDonations);
  if (showDonorHome && canDonors) refreshTargets.push(donorProfiles);
  if (showDonorHome && donorId !== null) refreshTargets.push(donorAppointments, donorDonations);

  const isRefreshing = refreshTargets.some((query) => query.isFetching);
  const lastUpdated = refreshTargets.reduce((latest, query) => Math.max(latest, query.dataUpdatedAt), 0);
  const hasLoadError = refreshTargets.some((query) => query.isError);

  const refreshAll = () => {
    refreshTargets.forEach((query) => {
      void query.refetch();
    });
  };

  const metrics = overviewMetrics(overview.data, 6);
  const pendingRequestItems = pendingRequests.data ?? [];
  const expiringUnits = expiringInventory.data?.content ?? [];
  const expiringTotal = expiringInventory.data?.totalElements ?? expiringUnits.length;
  const activeDispatches = (dispatches.data ?? []).filter((dispatch) =>
    ['PREPARING', 'IN_TRANSIT'].includes(dispatch.status.toUpperCase()),
  );
  const expiringReservations = (reservations.data ?? [])
    .filter((reservation) => reservation.status.toUpperCase() === 'ACTIVE')
    .map((reservation) => ({ reservation, days: daysUntil(reservation.expiresAt) }))
    .filter((entry) => entry.days !== null && entry.days <= 2)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  const reviewDonationItems = (reviewDonations.data ?? []).filter((donation) =>
    ['RECORDED', 'SCREENED'].includes(donation.status.toUpperCase()),
  );

  const upcomingAppointments = (donorAppointments.data ?? [])
    .filter((appointment) => new Date(appointment.scheduledAt).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const latestDonations = [...(donorDonations.data ?? [])]
    .sort((a, b) => new Date(b.donatedAt).getTime() - new Date(a.donatedAt).getTime())
    .slice(0, 4);

  const quickLinks: Array<{ label: string; to: string; icon: LucideIcon }> = [
    ...QUICK_ACTIONS.filter((action) => !action.rule || auth.canAccess(action.rule)).map((action) => ({
      label: action.label,
      to: action.to,
      icon: action.icon,
    })),
  ];
  if (showStaffHome && canReviewDonations) {
    quickLinks.push({ label: 'Donation review', to: '/app/donations', icon: ClipboardCheck });
  }
  if (showStaffHome && canDispatch) {
    quickLinks.push({ label: 'Dispatch board', to: '/app/dispatch', icon: Truck });
  }
  if (showStaffHome && canReservations) {
    quickLinks.push({ label: 'Reservations', to: '/app/reservations', icon: TicketCheck });
  }
  if (showStaffHome && auth.hasPermission(PERMISSIONS.AUDIT_READ)) {
    quickLinks.push({ label: 'Audit log', to: '/app/audit', icon: ScrollText });
  }
  if (showStaffHome && canAnalytics) {
    quickLinks.push({ label: 'Analytics', to: '/app/analytics', icon: Activity });
  }
  if (showDonorHome && canDonors) {
    quickLinks.push({ label: 'Appointments & consents', to: '/app/donors', icon: CalendarClock });
  }
  if (showDonorHome) {
    quickLinks.push({ label: 'My donations', to: '/app/donations', icon: HeartHandshake });
    quickLinks.push({ label: 'Account settings', to: '/app/profile', icon: UserRound });
  }

  const firstName = auth.user?.fullName.split(' ')[0] ?? 'there';
  const organizationName = organizationNameForScope(auth.user?.memberships, auth.organizationId);

  return (
    <div className="app-page page-enter">
      <header className="page-intro">
        <div>
          <span className="eyebrow"><LayoutDashboard size={14} aria-hidden="true" /> Workspace overview</span>
          <h1 className="page-title">Good to see you, {firstName}</h1>
          <p className="page-subtitle">
            {organizationName
              ? `Current picture for ${organizationName}. All values below come from the API.`
              : 'Current picture for your account. All values below come from the API.'}
          </p>
        </div>
        <div className="section-actions">
          <StatusBadge
            status={auth.user?.status}
            label={auth.user?.status === 'ACTIVE' ? 'Account active' : humanize(auth.user?.status)}
          />
          <span className="live-pill">
            <span className="live-dot" aria-hidden="true" />
            {isRefreshing ? 'Syncing' : hasLoadError ? 'Partial data' : 'Live view'}
          </span>
          <span className="freshness" aria-live="polite">
            {isRefreshing
              ? 'Refreshing now…'
              : lastUpdated > 0
                ? `Updated ${formatRelative(lastUpdated, now)}`
                : 'Waiting for first update'}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={refreshAll}
            disabled={isRefreshing || refreshTargets.length === 0}
            aria-busy={isRefreshing}
          >
            <RefreshCw size={14} aria-hidden="true" /> {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {showDonorHome && (
        <section className="surface surface-glass stagger-1" aria-labelledby="donor-home-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Your donation journey</span>
              <h2 className="page-title" id="donor-home-title">Your donor workspace</h2>
              <p className="page-subtitle">
                Your own appointments and donation records, loaded from the API. No staff-wide records are shown here.
              </p>
            </div>
            <div className="section-actions">
              {canDonors && (
                <Link className="btn btn-primary btn-sm" to="/app/donors">
                  Profile & consents
                </Link>
              )}
              <Link className="btn btn-secondary btn-sm" to="/app/donations">
                My donations
              </Link>
              <Link className="btn btn-ghost btn-sm" to="/app/profile">
                Account
              </Link>
            </div>
          </div>

          {canDonors && donorProfiles.isPending && <Skeleton width="60%" />}
          {canDonors && donorProfiles.isError && (
            <div className="surface">
              <ErrorState error={donorProfiles.error} onRetry={() => void donorProfiles.refetch()} />
            </div>
          )}
          {canDonors && donorProfiles.isSuccess && donorId === null && (
            <EmptyState
              title="No donor profile yet"
              description="Ask staff to link your account to a donor profile before requesting an appointment."
            />
          )}

          {donorId !== null && (
            <>
              <div className="metric-grid">
                <article className="metric-card">
                  <span className="metric-label">Upcoming appointments</span>
                  <strong className="metric-value">{formatNumber(upcomingAppointments.length)}</strong>
                  <span className="metric-delta">From your donor record</span>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Recorded donations</span>
                  <strong className="metric-value">{formatNumber(donorDonations.data?.length ?? 0)}</strong>
                  <span className="metric-delta">Your own donation history</span>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Blood group on file</span>
                  <strong className="metric-value">
                    {donorProfiles.data?.find((profile) => profile.id === donorId)?.bloodGroup
                      ? humanize(donorProfiles.data?.find((profile) => profile.id === donorId)?.bloodGroup)
                      : '—'}
                  </strong>
                  <span className="metric-delta">From your profile</span>
                </article>
              </div>

              <div className="split-layout">
                <section className="surface surface-raised" aria-labelledby="donor-appointments-title">
                  <div className="section-heading">
                    <div>
                      <h3 className="task-title" id="donor-appointments-title">Upcoming appointments</h3>
                      <p className="task-meta">Requested appointment slots for your profile.</p>
                    </div>
                  </div>
                  {donorAppointments.isPending && <Skeleton height={72} />}
                  {donorAppointments.isError && (
                    <ErrorState error={donorAppointments.error} onRetry={() => void donorAppointments.refetch()} />
                  )}
                  {donorAppointments.isSuccess && upcomingAppointments.length === 0 && (
                    <EmptyState title="No upcoming appointments" description="Appointments you request will appear here." />
                  )}
                  {upcomingAppointments.length > 0 && (
                    <div className="timeline-list">
                      {upcomingAppointments.map((appointment) => (
                        <article className="surface-interactive" key={appointment.id}>
                          <div className="task-title">
                            {formatDateTime(appointment.scheduledAt)} <StatusBadge status={appointment.status} />
                          </div>
                          <p className="task-meta">
                            {appointment.organizationName ?? `Organization #${appointment.organizationId}`}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="surface surface-raised" aria-labelledby="donor-donations-title">
                  <div className="section-heading">
                    <div>
                      <h3 className="task-title" id="donor-donations-title">Recent donations</h3>
                      <p className="task-meta">Donation records linked to your donor profile.</p>
                    </div>
                  </div>
                  {donorDonations.isPending && <Skeleton height={72} />}
                  {donorDonations.isError && (
                    <ErrorState error={donorDonations.error} onRetry={() => void donorDonations.refetch()} />
                  )}
                  {donorDonations.isSuccess && latestDonations.length === 0 && (
                    <EmptyState title="No donations recorded" description="Staff-recorded donations will appear here." />
                  )}
                  {latestDonations.length > 0 && (
                    <div className="timeline-list">
                      {latestDonations.map((donation) => (
                        <article className="surface-interactive" key={donation.id}>
                          <div className="task-title">
                            {formatDate(donation.donatedAt)} <StatusBadge status={donation.status} />
                          </div>
                          <p className="task-meta">
                            {donation.publicId ?? `Donation #${donation.id}`} · Organization #{donation.organizationId}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </section>
      )}

      {showStaffHome && (
        <>
          {canAnalytics && (
            <section className="surface surface-glass stagger-2" aria-labelledby="staff-metrics-title">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Operational pulse</span>
                  <h2 className="page-title" id="staff-metrics-title">Live counts from the analytics API</h2>
                  <p className="page-subtitle">Metrics are fetched only when your account has ANALYTICS_READ.</p>
                </div>
                <Link className="btn btn-ghost btn-sm" to="/app/analytics">
                  Open analytics <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </div>
              {overview.isPending && (
                <div className="metric-grid">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <article className="metric-card" key={index}>
                      <Skeleton width="60%" />
                      <Skeleton width="40%" height={28} />
                    </article>
                  ))}
                </div>
              )}
              {overview.isError && (
                <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
              )}
              {overview.isSuccess && metrics.length === 0 && (
                <EmptyState title="No summary metrics" description="The overview endpoint returned no numeric values for your scope." />
              )}
              {metrics.length > 0 && (
                <div className="metric-grid">
                  {metrics.map((metric) => (
                    <article className="metric-card" key={metric.label}>
                      <span className="metric-label">{metric.label}</span>
                      <strong className="metric-value">{formatNumber(metric.value)}</strong>
                      <span className="metric-delta">Analytics API</span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="stagger-2" aria-labelledby="task-queue-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Task queues</span>
                <h2 className="page-title" id="task-queue-title">What needs attention</h2>
                <p className="page-subtitle">Queues are shown only where your permissions allow them.</p>
              </div>
            </div>
            <div className="task-grid">
              {canRequests && canApproveRequests && (
                <TaskCard
                  icon={ClipboardList}
                  title="Pending request approvals"
                  count={pendingRequestItems.length}
                  meta="Requests awaiting verification"
                  to="/app/requests"
                  items={pendingRequestItems.slice(0, 3).map((request) =>
                    `${request.requestNumber} · ${humanize(request.bloodGroup)} · ${humanize(request.priority)}`,
                  )}
                  state={queueState(pendingRequests)}
                  error={pendingRequests.error}
                  onRetry={() => void pendingRequests.refetch()}
                />
              )}
              {canInventory && (
                <TaskCard
                  icon={PackageCheck}
                  title="Expiring inventory"
                  count={expiringTotal}
                  meta="Units returned within 7 days of expiry"
                  to="/app/inventory"
                  items={expiringUnits.slice(0, 3).map((unit) =>
                    `${unit.unitNumber} · ${humanize(unit.componentType)} · ${formatDate(unit.expiresAt)}`,
                  )}
                  state={queueState(expiringInventory)}
                  error={expiringInventory.error}
                  onRetry={() => void expiringInventory.refetch()}
                />
              )}
              {canDispatch && (
                <TaskCard
                  icon={Truck}
                  title="Active dispatches"
                  count={activeDispatches.length}
                  meta="Preparing or in transit"
                  to="/app/dispatch"
                  items={activeDispatches.slice(0, 3).map((dispatch) =>
                    `${dispatch.publicId ?? `DSP-${dispatch.id}`} · ${humanize(dispatch.status)} · ${dispatch.assignedStaff}`,
                  )}
                  state={queueState(dispatches)}
                  error={dispatches.error}
                  onRetry={() => void dispatches.refetch()}
                />
              )}
              {canReservations && (
                <TaskCard
                  icon={TicketCheck}
                  title="Reservation expiries"
                  count={expiringReservations.length}
                  meta="Active holds expiring within 2 days"
                  to="/app/reservations"
                  items={expiringReservations.slice(0, 3).map(({ reservation, days }) =>
                    `${reservation.publicId ?? `RES-${reservation.id}`} · ${days === 0 ? 'today' : `${days}d`} · ${formatDateTime(reservation.expiresAt)}`,
                  )}
                  state={queueState(reservations)}
                  error={reservations.error}
                  onRetry={() => void reservations.refetch()}
                />
              )}
              {canReviewDonations && (
                <TaskCard
                  icon={HeartHandshake}
                  title="Donation review"
                  count={reviewDonationItems.length}
                  meta="Recorded or screened donations"
                  to="/app/donations"
                  items={reviewDonationItems.slice(0, 3).map((donation) =>
                    `${donation.publicId ?? `DON-${donation.id}`} · ${donation.donorName ?? `Donor #${donation.donorId}`}`,
                  )}
                  state={queueState(reviewDonations)}
                  error={reviewDonations.error}
                  onRetry={() => void reviewDonations.refetch()}
                />
              )}
            </div>
          </section>

          <section className="surface surface-raised stagger-3" aria-labelledby="quick-actions-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Shortcuts</span>
                <h2 className="page-title" id="quick-actions-title">Quick actions</h2>
                <p className="page-subtitle">Only actions available to your role are shown.</p>
              </div>
            </div>
            <div className="task-grid">
              {quickLinks.map((link) => (
                <Link className="task-card surface-interactive" key={`${link.label}-${link.to}`} to={link.to}>
                  <span className="task-icon"><link.icon size={18} aria-hidden="true" /></span>
                  <strong className="task-title">{link.label}</strong>
                  <span className="task-cta">Open workspace <ArrowUpRight size={14} aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          </section>

          <p className="freshness">
            <ShieldCheck size={13} aria-hidden="true" /> The server independently enforces every permission shown here.
          </p>
        </>
      )}
    </div>
  );
}
