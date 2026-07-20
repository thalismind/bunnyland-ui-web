import type { ComponentChildren, JSX } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import {
  ApiError,
  authMe,
  login as createSession,
  logout as deleteSession,
  rotateAuth,
  setPlayerAuth,
  subscribePlayerAuth,
} from '../api';
import { Button, EmptyState, StatusText } from './components';

export const AUTH_SCOPES = [
  'character:profile',
  'character:chat',
  'world:play',
  'world:admin',
] as const;

export type AuthScope = typeof AUTH_SCOPES[number];
export type AuthStatus = 'anonymous' | 'authenticated' | 'checking' | 'error' | 'idle';

export interface AuthSession {
  expires_at: number;
  rotate_after: number | null;
  rotation_eligible: boolean;
  scopes: AuthScope[];
  subject: string;
}

export interface AuthContextValue {
  closeLogin: () => void;
  error: string;
  hasScopes: (scopes: readonly AuthScope[]) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  openLogin: (scopes: readonly AuthScope[]) => void;
  refresh: () => Promise<void>;
  session: AuthSession | null;
  status: AuthStatus;
}

interface AuthProviderProps {
  base: string;
  children: ComponentChildren;
}

interface AuthGateProps {
  children: ComponentChildren;
  scopes: readonly AuthScope[];
}

const SCOPE_LABELS: Record<AuthScope, string> = {
  'character:profile': 'Character profile',
  'character:chat': 'Character chat',
  'world:play': 'World play',
  'world:admin': 'World administration',
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isAuthScope(value: unknown): value is AuthScope {
  return typeof value === 'string' && (AUTH_SCOPES as readonly string[]).includes(value);
}

function parseSession(value: unknown): AuthSession {
  if (!value || typeof value !== 'object') throw new Error('Invalid authentication response');
  const record = value as Record<string, unknown>;
  if (typeof record.subject !== 'string' || !Array.isArray(record.scopes)) {
    throw new Error('Invalid authentication response');
  }
  return {
    subject: record.subject,
    scopes: record.scopes.filter(isAuthScope),
    expires_at: Number(record.expires_at || 0),
    rotate_after: record.rotate_after == null ? null : Number(record.rotate_after),
    rotation_eligible: Boolean(record.rotation_eligible),
  };
}

export function effectiveAuthScopes(scopes: readonly AuthScope[]): ReadonlySet<AuthScope> {
  const effective = new Set(scopes);
  if (effective.has('world:admin')) effective.add('world:play');
  if (effective.has('world:play')) {
    effective.add('character:profile');
    effective.add('character:chat');
  }
  return effective;
}

export function hasAuthScopes(
  granted: readonly AuthScope[],
  required: readonly AuthScope[],
): boolean {
  const effective = effectiveAuthScopes(granted);
  return required.every(scope => effective.has(scope));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function LoginDialog({
  close,
  login,
  scopes,
}: {
  close: () => void;
  login: (username: string, password: string) => Promise<void>;
  scopes: readonly AuthScope[];
}): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    };
  }, []);

  const submit = async (event: JSX.TargetedSubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!username.trim() || !password || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password);
      close();
    } catch (loginError) {
      setError(errorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      aria-labelledby="bl-auth-title"
      class="bl-auth-dialog"
      onCancel={(event): void => { event.preventDefault(); close(); }}
      ref={dialogRef}
    >
      <form class="bl-auth-form" onSubmit={(event): void => { void submit(event); }}>
        <h2 id="bl-auth-title">Sign in to Bunnyland</h2>
        <label>
          <span>Username</span>
          <input
            autocomplete="username"
            autofocus
            disabled={submitting}
            onInput={(event): void => setUsername(event.currentTarget.value)}
            required
            value={username}
          />
        </label>
        <label>
          <span>Password</span>
          <input
            autocomplete="current-password"
            disabled={submitting}
            onInput={(event): void => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error && <StatusText role="alert" tone="error">{error}</StatusText>}
        <p class="bl-auth-scopes">
          Requested access: {scopes.map(scope => `${SCOPE_LABELS[scope]} (${scope})`).join(', ')}.
          Your account determines the access granted.
        </p>
        <div class="bl-auth-actions">
          <Button disabled={submitting} onClick={close}>Cancel</Button>
          <Button disabled={submitting || !username.trim() || !password} type="submit" variant="primary">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function AuthProvider({ base, children }: AuthProviderProps): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>(base ? 'checking' : 'idle');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState('');
  const [loginScopes, setLoginScopes] = useState<readonly AuthScope[] | null>(null);
  const requestGeneration = useRef(0);
  const rotationAttempt = useRef('');

  const refresh = useCallback(async (): Promise<void> => {
    const generation = ++requestGeneration.current;
    if (!base) {
      setSession(null);
      setError('');
      setStatus('idle');
      return;
    }
    setStatus('checking');
    setError('');
    try {
      const next = parseSession(await authMe(base));
      if (generation !== requestGeneration.current) return;
      setSession(next);
      setStatus('authenticated');
    } catch (authError) {
      if (generation !== requestGeneration.current) return;
      setSession(null);
      if (authError instanceof ApiError && authError.status === 401) {
        setStatus('anonymous');
      } else {
        setError(errorMessage(authError));
        setStatus('error');
      }
    }
  }, [base]);

  useEffect(() => {
    void refresh();
    return subscribePlayerAuth(() => { void refresh(); });
  }, [refresh]);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    const next = parseSession(await createSession(base, username, password));
    setPlayerAuth('');
    requestGeneration.current += 1;
    setSession(next);
    setError('');
    setStatus('authenticated');
  }, [base]);

  const logout = useCallback(async (): Promise<void> => {
    await deleteSession(base);
    setPlayerAuth('');
    requestGeneration.current += 1;
    setSession(null);
    setError('');
    setStatus('anonymous');
  }, [base]);

  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    const now = Date.now();
    const expiresDelay = Math.max(0, session.expires_at * 1000 - now);
    const rotateDelay = session.rotate_after == null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, session.rotate_after * 1000 - now);
    const delay = Math.min(expiresDelay, rotateDelay, 2147483647);
    const timer = window.setTimeout(() => {
      if (rotateDelay <= expiresDelay && session.rotate_after != null) {
        const attempt = `${base}:${session.subject}:${session.rotate_after}`;
        if (rotationAttempt.current === attempt) return;
        rotationAttempt.current = attempt;
        void rotateAuth(base)
          .then(value => {
            const next = parseSession(value);
            setSession(next);
            setStatus('authenticated');
          })
          .catch(() => { void refresh(); });
      } else {
        void refresh();
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [base, refresh, session, status]);

  const hasScopes = useCallback((scopes: readonly AuthScope[]): boolean => (
    Boolean(session && hasAuthScopes(session.scopes, scopes))
  ), [session]);
  const openLogin = useCallback((scopes: readonly AuthScope[]): void => setLoginScopes([...scopes]), []);
  const closeLogin = useCallback((): void => setLoginScopes(null), []);
  const value = useMemo<AuthContextValue>(() => ({
    closeLogin,
    error,
    hasScopes,
    login,
    logout,
    openLogin,
    refresh,
    session,
    status,
  }), [closeLogin, error, hasScopes, login, logout, openLogin, refresh, session, status]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {loginScopes && <LoginDialog close={closeLogin} login={login} scopes={loginScopes} />}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used within an AuthProvider');
  return auth;
}

export function AuthGate({ children, scopes }: AuthGateProps): JSX.Element {
  const auth = useAuth();
  if (auth.status === 'authenticated' && auth.hasScopes(scopes)) return <>{children}</>;
  if (auth.status === 'checking') return <EmptyState class="bl-auth-gate">Checking access…</EmptyState>;
  if (auth.status === 'idle') return <EmptyState class="bl-auth-gate">Choose a server to continue.</EmptyState>;
  if (auth.status === 'error') {
    return (
      <EmptyState class="bl-auth-gate">
        <StatusText tone="error">Authentication check failed: {auth.error}</StatusText>
        <Button onClick={(): void => { void auth.refresh(); }}>Retry</Button>
      </EmptyState>
    );
  }
  if (auth.status === 'authenticated') {
    const missing = scopes.filter(scope => !effectiveAuthScopes(auth.session?.scopes || []).has(scope));
    return (
      <EmptyState class="bl-auth-gate">
        <StatusText tone="error">Insufficient access for {auth.session?.subject || 'this account'}.</StatusText>
        <small>Missing: {missing.map(scope => `${SCOPE_LABELS[scope]} (${scope})`).join(', ')}.</small>
        <Button onClick={(): void => auth.openLogin(scopes)}>Sign in as another user</Button>
      </EmptyState>
    );
  }
  return (
    <EmptyState class="bl-auth-gate">
      <span>Sign in to continue.</span>
      <Button onClick={(): void => auth.openLogin(scopes)} variant="primary">Login</Button>
    </EmptyState>
  );
}
