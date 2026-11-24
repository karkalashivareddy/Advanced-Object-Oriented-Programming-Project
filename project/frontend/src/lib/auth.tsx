import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { resolveOrganizationScope } from './organization';
import { tokenStore } from './tokenStore';
import { canAccess as checkAccess, hasAnyPermission, hasPermission as checkPermission, hasRole as checkRole, type AccessRule } from './permissions';
import type { AuthResponse, Role, UserView } from '@/types/domain';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  fullName: string;
  phone?: string;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: UserView | null;
  status: AuthStatus;
  organizationId: number | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  selectOrganization: (organizationId: number | null) => void;
  setUser: (user: UserView) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (role: Role) => boolean;
  canAccess: (rule: AccessRule) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function contextFromUser(user: UserView | null) {
  return { roles: user?.roles ?? [], permissions: user?.permissions ?? [], status: user?.status };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserView | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const bootstrapStarted = useRef(false);

  /** Drops every cached response so data from the previous scope is never rendered. */
  const clearScopedData = useCallback(() => {
    queryClient.clear();
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const syncOrganization = useCallback(
    (nextUser: UserView) => {
      const stored = tokenStore.getOrganizationId();
      // Platform admins may work unscoped. No user is silently scoped to a
      // first membership: multi-membership accounts must choose explicitly.
      const resolved = resolveOrganizationScope(nextUser.memberships, stored);
      if (stored !== resolved) clearScopedData();
      tokenStore.setOrganizationId(resolved);
      setOrganizationId(resolved);
    },
    [clearScopedData],
  );

  const applyAuth = useCallback(
    (response: AuthResponse) => {
      tokenStore.setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
      setStatus('authenticated');
      syncOrganization(response.user);
    },
    [syncOrganization],
  );

  const refresh = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) throw new Error('No active session.');
    const response = await api.post<AuthResponse>(
      '/auth/refresh',
      { refreshToken },
      { auth: false },
    );
    applyAuth(response);
  }, [applyAuth]);

  useEffect(() => {
    tokenStore.registerRefreshHandler(async () => {
      try {
        await refresh();
        return true;
      } catch {
        setUser(null);
        setStatus('unauthenticated');
        return false;
      }
    });

    const unsubscribe = tokenStore.onSessionExpired(() => {
      setUser(null);
      setStatus('unauthenticated');
      setOrganizationId(null);
    });

    if (!bootstrapStarted.current) {
      bootstrapStarted.current = true;
      if (tokenStore.getRefreshToken()) {
        refresh().catch(() => {
          tokenStore.clear();
          setUser(null);
          setStatus('unauthenticated');
        });
      } else {
        setStatus('unauthenticated');
      }
    }

    return () => {
      tokenStore.registerRefreshHandler(null);
      unsubscribe();
    };
  }, [refresh]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await api.post<AuthResponse>('/auth/login', input, { auth: false });
      applyAuth(response);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await api.post<AuthResponse>('/auth/register', input, { auth: false });
      applyAuth(response);
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
    tokenStore.clear();
    tokenStore.setOrganizationId(null);
    clearScopedData();
    setUser(null);
    setOrganizationId(null);
    setStatus('unauthenticated');
  }, [clearScopedData]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  }, []);

  const selectOrganization = useCallback(
    (id: number | null) => {
      if (
        id !== null &&
        !(user?.memberships ?? []).some((membership) => membership.organizationId === id)
      ) {
        throw new Error('That organization is not available to this account.');
      }
      if (id === organizationId) return;
      tokenStore.setOrganizationId(id);
      clearScopedData();
      setOrganizationId(id);
    },
    [user, organizationId, clearScopedData],
  );

  const value = useMemo<AuthContextValue>(() => {
    const context = contextFromUser(user);
    return {
      user,
      status,
      organizationId,
      login,
      register,
      logout,
      refresh,
      changePassword,
      selectOrganization,
      setUser,
      hasPermission: (permission) => checkPermission(context, permission),
      hasAnyPermission: (permissions) => hasAnyPermission(context, permissions),
      hasRole: (role) => checkRole(context, role),
      canAccess: (rule) => checkAccess(context, rule),
    };
  }, [user, status, organizationId, login, register, logout, refresh, changePassword, selectOrganization]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
