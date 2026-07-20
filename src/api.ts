export interface AdminAuth {
  authorization?: string;
  clientId?: string;
}

export interface ControlClaimLike {
  claimId?: string;
  claimSecret?: string;
  clientId?: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let playerAuthHeader = '';
const playerAuthListeners = new Set<() => void>();
let browserClientId = typeof globalThis.crypto?.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function normalizeBase(url: string): string {
  return String(url || '').trim().replace(/\/$/, '');
}

export function assertSameOriginBase(
  base: string,
  pageLocation = globalThis.location,
): string {
  const normalized = normalizeBase(base);
  if (!pageLocation) return normalized;
  const resolved = new URL(normalized || '/', pageLocation.href);
  if (resolved.origin !== pageLocation.origin) {
    throw new Error('Bunnyland browser connections must use the page origin');
  }
  return normalized;
}

export function serverFromUrl(search = globalThis.location?.search || ''): string {
  const configured = new URLSearchParams(search).get('server') || '';
  return configured ? assertSameOriginBase(configured) : '';
}

export function setServerInUrl(base: string, href = globalThis.location?.href || ''): void {
  if (!href || !globalThis.history) return;
  const url = new URL(href);
  const normalized = assertSameOriginBase(base);
  if (normalized) url.searchParams.set('server', normalized);
  else url.searchParams.delete('server');
  history.replaceState(null, '', url);
}

export function jsonHeaders(authHeader = ''): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Bunnyland-Client-Id': browserClientId,
    ...(authHeader.startsWith('Bearer ') ? { Authorization: authHeader } : {}),
  };
}

export function adminHeaders(auth: AdminAuth = {}, contentType = ''): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Bunnyland-Client-Id': auth.clientId || browserClientId,
  };
  if (contentType) headers['Content-Type'] = contentType;
  if (auth.authorization?.startsWith('Bearer ')) headers.Authorization = auth.authorization;
  return headers;
}

export function claimHeaders(control: ControlClaimLike | null = null): Record<string, string> {
  return {
    ...jsonHeaders(playerAuthHeader),
    'X-Bunnyland-Client-Id': control?.clientId || browserClientId,
    ...(control?.claimSecret ? { 'X-Bunnyland-Claim-Secret': control.claimSecret } : {}),
  };
}

export function mergePlayerHeaders(headers: HeadersInit = {}): Headers {
  const merged = new Headers(headers);
  if (!merged.has('X-Bunnyland-Client-Id')) {
    merged.set('X-Bunnyland-Client-Id', browserClientId);
  }
  if (playerAuthHeader.startsWith('Bearer ')) {
    merged.set('Authorization', playerAuthHeader);
  }
  return merged;
}

export async function parseJsonResponse(res: Response): Promise<unknown> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data === 'object' && data && 'detail' in data ? String(data.detail) : `HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return data;
}

export async function sendJson(base: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = mergePlayerHeaders(init.headers || {});
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return parseJsonResponse(await fetch(`${assertSameOriginBase(base)}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  }));
}

export async function login(base: string, username: string, password: string): Promise<unknown> {
  assertSameOriginBase(base);
  return sendJson(base, '/auth/session', {
    method: 'POST',
    body: JSON.stringify({ username, password, delivery: 'cookie' }),
  });
}

export async function authMe(base: string): Promise<unknown> {
  return sendJson(base, '/auth/session');
}

export async function rotateAuth(base: string): Promise<unknown> {
  return sendJson(base, '/auth/session', { method: 'PATCH' });
}

export async function logout(base: string): Promise<unknown> {
  return sendJson(base, '/auth/session', { method: 'DELETE' });
}

export function setPlayerAuth(authHeader = ''): void {
  const next = authHeader.startsWith('Bearer ') ? authHeader : '';
  if (next === playerAuthHeader) return;
  playerAuthHeader = next;
  for (const listener of playerAuthListeners) listener();
}

export function getPlayerAuth(): string {
  return playerAuthHeader;
}

export function subscribePlayerAuth(listener: () => void): () => void {
  playerAuthListeners.add(listener);
  return () => playerAuthListeners.delete(listener);
}

export function setClientId(clientId: string): void {
  const normalized = clientId.trim();
  if (normalized) browserClientId = normalized;
}

export function getClientId(): string {
  return browserClientId;
}

export async function sendAdmin(base: string, path: string, auth: AdminAuth = {}, init: RequestInit = {}): Promise<unknown> {
  return parseJsonResponse(await fetch(`${assertSameOriginBase(base)}${path}`, {
    ...init,
    headers: adminHeaders(auth),
    credentials: 'include',
  }));
}

export function socketUrl(base: string, path = '/admin/world/stream', _authHeader = ''): string {
  const normalized = assertSameOriginBase(base);
  const httpUrl = globalThis.location
    ? new URL(`${normalized}${path}`, globalThis.location.href).href
    : `${normalized}${path}`;
  return httpUrl.replace(/^http/, 'ws');
}

export function mediaUrl(base: string, url: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (/^https?:/.test(url)) {
    assertSameOriginBase(url);
    return url;
  }
  return `${assertSameOriginBase(base)}${url}`;
}

export async function requestSceneImage(base: string, characterId: string, control: ControlClaimLike | null = null): Promise<unknown> {
  void characterId;
  if (!control?.claimId) throw new Error('A character claim is required');
  return sendJson(base, `/play/claims/${encodeURIComponent(control.claimId)}/jobs`, {
    method: 'POST',
    headers: claimHeaders(control),
    body: JSON.stringify({ kind: 'scene_image' }),
  });
}
