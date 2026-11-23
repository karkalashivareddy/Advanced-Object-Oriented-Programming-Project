import { describe, expect, it } from 'vitest';
import { evaluateRouteAccess, type RouteAuthState } from './routeGuard';

const base: RouteAuthState = {
  session: 'authenticated',
  roles: [],
  permissions: [],
};

describe('route guard', () => {
  it('reports loading and unauthenticated sessions', () => {
    expect(evaluateRouteAccess({ ...base, session: 'loading' }, '/app/dashboard')).toBe('loading');
    expect(evaluateRouteAccess({ ...base, session: 'unauthenticated' }, '/app/dashboard')).toBe('login');
  });

  it('allows any authenticated user into the dashboard', () => {
    expect(evaluateRouteAccess({ ...base, roles: ['DONOR'] }, '/app/dashboard')).toBe('allow');
  });

  it('blocks roles without the required permission', () => {
    expect(evaluateRouteAccess({ ...base, roles: ['DONOR'] }, '/app/inventory')).toBe('forbidden');
  });

  it('allows role-derived permissions and explicit permissions', () => {
    expect(evaluateRouteAccess({ ...base, roles: ['INVENTORY_MANAGER'] }, '/app/inventory')).toBe('allow');
    expect(evaluateRouteAccess({ ...base, permissions: ['AUDIT_READ'] }, '/app/audit')).toBe('allow');
  });

  it('allows platform admins into administration', () => {
    expect(evaluateRouteAccess({ ...base, roles: ['PLATFORM_ADMIN'] }, '/app/admin/users')).toBe('allow');
  });

  it('blocks non-active user statuses', () => {
    expect(evaluateRouteAccess({ ...base, roles: ['PLATFORM_ADMIN'], userStatus: 'LOCKED' }, '/app/dashboard')).toBe('forbidden');
  });
});
