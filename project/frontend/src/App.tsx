import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui';
import {
  BloodWipe,
  RouteFallback,
  RouteTransition,
  TopProgress,
  useMotionVisibility,
  useScrollRestoration,
} from '@/components/motion';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LandingPage } from '@/pages/public/LandingPage';
import { LoginPage } from '@/pages/public/LoginPage';
import { RegisterPage } from '@/pages/public/RegisterPage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';

const DashboardPage = lazy(async () => ({ default: (await import('@/pages/app/DashboardPage')).DashboardPage }));
const InventoryPage = lazy(async () => ({ default: (await import('@/pages/app/InventoryPage')).InventoryPage }));
const DonorsPage = lazy(async () => ({ default: (await import('@/pages/app/DonorsPage')).DonorsPage }));
const NearbyDonorsPage = lazy(async () => ({ default: (await import('@/pages/app/NearbyDonorsPage')).NearbyDonorsPage }));
const DonationsPage = lazy(async () => ({ default: (await import('@/pages/app/DonationsPage')).DonationsPage }));
const RequestsPage = lazy(async () => ({ default: (await import('@/pages/app/RequestsPage')).RequestsPage }));
const AllocationsPage = lazy(async () => ({ default: (await import('@/pages/app/AllocationsPage')).AllocationsPage }));
const ReservationsPage = lazy(async () => ({ default: (await import('@/pages/app/ReservationsPage')).ReservationsPage }));
const DispatchPage = lazy(async () => ({ default: (await import('@/pages/app/DispatchPage')).DispatchPage }));
const NotificationsPage = lazy(async () => ({ default: (await import('@/pages/app/NotificationsPage')).NotificationsPage }));
const AuditPage = lazy(async () => ({ default: (await import('@/pages/app/AuditPage')).AuditPage }));
const AnalyticsPage = lazy(async () => ({ default: (await import('@/pages/app/AnalyticsPage')).AnalyticsPage }));
const UsersAdminPage = lazy(async () => ({ default: (await import('@/pages/app/UsersAdminPage')).UsersAdminPage }));
const OrganizationsAdminPage = lazy(async () => ({ default: (await import('@/pages/app/OrganizationsAdminPage')).OrganizationsAdminPage }));
const ProfilePage = lazy(async () => ({ default: (await import('@/pages/app/ProfilePage')).ProfilePage }));
const DesignKitPage = lazy(async () => ({ default: (await import('@/pages/public/DesignKitPage')).DesignKitPage }));

const routeChunks = [
  () => import('@/pages/app/DashboardPage'),
  () => import('@/pages/app/InventoryPage'),
  () => import('@/pages/app/DonorsPage'),
  () => import('@/pages/app/DonationsPage'),
  () => import('@/pages/app/RequestsPage'),
  () => import('@/pages/app/AnalyticsPage'),
];

/** Warm likely next routes during idle time without changing navigation behaviour. */
function useRoutePrefetch(): void {
  useEffect(() => {
    const warm = () => routeChunks.forEach((load) => void load());
    const idle = window.requestIdleCallback;
    if (typeof idle === 'function') {
      const handle = idle(warm, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(handle);
  }, []);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

function AppRoutes() {
  const location = useLocation();
  const publicTransition = !location.pathname.startsWith('/app');
  useScrollRestoration();
  useMotionVisibility();
  useRoutePrefetch();

  const routes = (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {import.meta.env.DEV && <Route path="/__kit" element={<DesignKitPage />} />}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="donors" element={<DonorsPage />} />
          <Route path="donors/nearby" element={<NearbyDonorsPage />} />
          <Route path="donations" element={<DonationsPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="allocations" element={<AllocationsPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="dispatch" element={<DispatchPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="admin/users" element={<UsersAdminPage />} />
          <Route path="admin/organizations" element={<OrganizationsAdminPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );

  return (
    <>
      <TopProgress />
      <BloodWipe />
      <Suspense fallback={<RouteFallback />}>
        {publicTransition ? <RouteTransition>{routes}</RouteTransition> : routes}
      </Suspense>
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
