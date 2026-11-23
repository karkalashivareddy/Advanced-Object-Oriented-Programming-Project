/**
 * In-memory access token with a sessionStorage-backed refresh token.
 * Keeping the access token out of web storage reduces exposure to XSS token theft;
 * the refresh token is scoped to the browser tab session. See frontend/README.md.
 */

const REFRESH_KEY = 'lifelink.refreshToken';
const ORG_KEY = 'lifelink.organizationId';

let accessToken: string | null = null;
let refreshToken: string | null = readStorage(sessionStorageLike(), REFRESH_KEY);
let refreshHandler: (() => Promise<boolean>) | null = null;
const sessionListeners = new Set<() => void>();

function sessionStorageLike(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function readStorage(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | null, key: string, value: string | null): void {
  try {
    if (!storage) return;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    /* storage may be unavailable in private browsing */
  }
}

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  getRefreshToken(): string | null {
    return refreshToken;
  },

  setTokens(nextAccessToken: string, nextRefreshToken?: string): void {
    accessToken = nextAccessToken;
    if (nextRefreshToken !== undefined) {
      refreshToken = nextRefreshToken;
      writeStorage(sessionStorageLike(), REFRESH_KEY, nextRefreshToken);
    }
  },

  setAccessToken(nextAccessToken: string): void {
    accessToken = nextAccessToken;
  },

  /** Called by the API client after a 401. The handler performs a public refresh request. */
  registerRefreshHandler(handler: (() => Promise<boolean>) | null): void {
    refreshHandler = handler;
  },

  async refresh(): Promise<boolean> {
    if (!refreshToken || !refreshHandler) return false;
    return refreshHandler();
  },

  clear(): void {
    accessToken = null;
    refreshToken = null;
    writeStorage(sessionStorageLike(), REFRESH_KEY, null);
  },

  /** Clears tokens and notifies the auth context so the UI reflects the expired session. */
  expireSession(): void {
    tokenStore.clear();
    sessionListeners.forEach((listener) => listener());
  },

  onSessionExpired(listener: () => void): () => void {
    sessionListeners.add(listener);
    return () => sessionListeners.delete(listener);
  },

  getOrganizationId(): number | null {
    const value = readStorage(sessionStorageLike(), ORG_KEY);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },

  setOrganizationId(id: number | null): void {
    writeStorage(sessionStorageLike(), ORG_KEY, id === null ? null : String(id));
  },
};
