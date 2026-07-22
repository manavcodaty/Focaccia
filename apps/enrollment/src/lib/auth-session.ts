import type { Session } from '@supabase/supabase-js';

const SESSION_REFRESH_MARGIN_MS = 60_000;
const STALE_REFRESH_TOKEN_CODES = new Set([
  'invalid_refresh_token',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'refresh_token_revoked',
]);

interface AuthResult {
  data: { session: Session | null };
  error: Error | null;
}

interface RefreshResult {
  data: { session: Session | null; user: unknown };
  error: Error | null;
}

interface EnrollmentAuthClient {
  getSession(): Promise<AuthResult>;
  setSession(session: { access_token: string; refresh_token: string }): Promise<RefreshResult>;
  startAutoRefresh(): Promise<void>;
}

interface AsyncKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
}

export interface DeferredAuthStorage {
  clear(): Promise<void>;
  read(): Promise<string | null>;
  release(): void;
  storage: AsyncKeyValueStorage;
}

interface SessionRestoreResult {
  error: Error | null;
  session: Session | null;
}

function isStaleRefreshTokenError(error: Error): boolean {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return STALE_REFRESH_TOKEN_CODES.has(code)
    || /invalid refresh token|refresh token (?:is not valid|not found|already used|revoked)/i.test(error.message);
}

function needsRefresh(session: Session, nowMs: number): boolean {
  if (!session.expires_at) return true;
  return session.expires_at * 1000 <= nowMs + SESSION_REFRESH_MARGIN_MS;
}

function parsePersistedSession(value: string | null): Session | null {
  if (!value) return null;
  try {
    const session = JSON.parse(value) as Partial<Session>;
    if (
      typeof session.access_token !== 'string'
      || typeof session.refresh_token !== 'string'
      || typeof session.expires_at !== 'number'
      || !session.user
    ) {
      return null;
    }
    return session as Session;
  } catch {
    return null;
  }
}

export function createDeferredAuthStorage(
  baseStorage: AsyncKeyValueStorage,
  storageKey: string,
): DeferredAuthStorage {
  let released = false;

  return {
    clear() {
      return baseStorage.removeItem(storageKey);
    },
    read() {
      return baseStorage.getItem(storageKey);
    },
    release() {
      released = true;
    },
    storage: {
      getItem(key) {
        if (!released && key === storageKey) return Promise.resolve(null);
        return baseStorage.getItem(key);
      },
      removeItem(key) {
        return baseStorage.removeItem(key);
      },
      setItem(key, value) {
        return baseStorage.setItem(key, value);
      },
    },
  };
}

export async function restoreEnrollmentSession(
  auth: EnrollmentAuthClient,
  storage: DeferredAuthStorage,
  nowMs = Date.now(),
): Promise<SessionRestoreResult> {
  const serializedSession = await storage.read();
  const currentSession = parsePersistedSession(serializedSession);

  if (serializedSession && !currentSession) {
    await storage.clear();
  }

  if (!currentSession || !needsRefresh(currentSession, nowMs)) {
    storage.release();
    const initial = await auth.getSession();
    await auth.startAutoRefresh();
    return { error: initial.error, session: initial.data.session };
  }

  let refreshed: RefreshResult;
  try {
    refreshed = await auth.setSession({
      access_token: currentSession.access_token,
      refresh_token: currentSession.refresh_token,
    });
  } finally {
    storage.release();
  }
  await auth.startAutoRefresh();

  if (refreshed.error) {
    if (isStaleRefreshTokenError(refreshed.error)) {
      return { error: null, session: null };
    }
    return { error: refreshed.error, session: currentSession };
  }

  return { error: null, session: refreshed.data.session };
}
