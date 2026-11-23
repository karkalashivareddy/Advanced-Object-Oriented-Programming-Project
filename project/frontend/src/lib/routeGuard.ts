import { ruleForPath } from './navigation';
import { canAccess } from './permissions';
import type { Role, UserStatus } from '@/types/domain';

export type RouteAccessResult = 'loading' | 'login' | 'forbidden' | 'allow';

export interface RouteAuthState {
  session: 'loading' | 'authenticated' | 'unauthenticated';
  userStatus?: UserStatus;
  roles: readonly Role[];
  permissions: readonly string[];
}

/** Pure decision function shared by the route guard and its unit tests. */
export function evaluateRouteAccess(auth: RouteAuthState, pathname: string): RouteAccessResult {
  if (auth.session === 'loading') return 'loading';
  if (auth.session === 'unauthenticated') return 'login';
  if (auth.userStatus && auth.userStatus !== 'ACTIVE') return 'forbidden';

  const rule = ruleForPath(pathname);
  const allowed = canAccess(
    {
      roles: auth.roles,
      permissions: auth.permissions,
      status: auth.userStatus,
    },
    rule ?? {},
  );
  return allowed ? 'allow' : 'forbidden';
}
