import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { evaluateRouteAccess } from '@/lib/routeGuard';
import { PageSkeleton } from '@/components/ui';
import { ForbiddenPage } from '@/pages/public/ForbiddenPage';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  const result = evaluateRouteAccess(
    {
      session: auth.status,
      userStatus: auth.user?.status,
      roles: auth.user?.roles ?? [],
      permissions: auth.user?.permissions ?? [],
    },
    location.pathname,
  );

  if (result === 'loading') {
    return (
      <div className="app-content" style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <PageSkeleton />
      </div>
    );
  }

  if (result === 'login') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (result === 'forbidden') return <ForbiddenPage />;

  return <Outlet />;
}
