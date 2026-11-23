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
  const [user, setUser] = useState<UserView | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const bootstrapStarted = useRef(false);

  const syncOrganization = useCallback((nextUser: UserView) => {
    const stored = tokenStore.getOrganizationId();
    const validIds = nextUser.memberships.map((membership) => membership.organizationId);
    const resolved = stored && validIds.includes(stored) ? stored : (validIds[0] ?? null);
    tokenStore.setOrganizationId(resolved);
    setOrganizationId(resolved);
  }, []);

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
    setUser(null);
    setOrganizationId(null);
    setStatus('unauthenticated');
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  }, []);

  const selectOrganization = useCallback((id: number | null) => {
    tokenStore.setOrganizationId(id);
    setOrganizationId(id);
  }, []);

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
