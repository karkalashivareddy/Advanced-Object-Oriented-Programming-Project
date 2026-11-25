import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { Skeleton, ToastProvider } from '@/components/ui';
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

function RouteFallback() {
  return (
    <div className="card card-pad" role="status" aria-live="polite">
      <div className="skeleton-lines">
        <Skeleton height={20} width="45%" />
        <Skeleton height={14} />
        <Skeleton height={14} width="80%" />
        <Skeleton height={200} />
      </div>
      <span className="sr-only">Loading page…</span>
    </div>
  );
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

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
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
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
