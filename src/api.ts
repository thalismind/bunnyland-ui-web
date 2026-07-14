export interface AdminAuth {
  authorization?: string;
}

export interface ControlClaimLike {
  claimId?: string;
  claimSecret?: string;
}

let playerAuthHeader = '';

export function normalizeBase(url: string): string {
  return String(url || '').trim().replace(/\/$/, '');
}

export function serverFromUrl(search = globalThis.location?.search || ''): string {
  return new URLSearchParams(search).get('server') || '';
}

export function setServerInUrl(base: string, href = globalThis.location?.href || ''): void {
  if (!href || !globalThis.history) return;
  const url = new URL(href);
  const normalized = normalizeBase(base);
  if (normalized) url.searchParams.set('server', normalized);
  else url.searchParams.delete('server');
  history.replaceState(null, '', url);
}

export function jsonHeaders(authHeader = ''): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(authHeader.startsWith('Bearer ') ? { Authorization: authHeader } : {}),
  };
}

export function adminHeaders(auth: AdminAuth = {}, contentType = ''): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (auth.authorization?.startsWith('Bearer ')) headers.Authorization = auth.authorization;
  return headers;
}

export function claimHeaders(control: ControlClaimLike | null = null): Record<string, string> {
  return {
    ...jsonHeaders(playerAuthHeader),
    ...(control?.claimSecret ? { 'X-Bunnyland-Claim-Secret': control.claimSecret } : {}),
  };
}

export function mergePlayerHeaders(headers: HeadersInit = {}): Headers {
  const merged = new Headers(headers);
  if (playerAuthHeader.startsWith('Bearer ')) {
    merged.set('Authorization', playerAuthHeader);
  }
  return merged;
}

export async function parseJsonResponse(res: Response): Promise<unknown> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data === 'object' && data && 'detail' in data ? String(data.detail) : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function sendJson(base: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = mergePlayerHeaders(init.headers || {});
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return parseJsonResponse(await fetch(`${normalizeBase(base)}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  }));
}

export async function login(base: string, username: string, password: string): Promise<unknown> {
  const pageLocation = globalThis.location;
  if (!pageLocation || new URL(normalizeBase(base) || '/', pageLocation.href).origin !== pageLocation.origin) {
    throw new Error('Refusing to send Bunnyland credentials to a different origin');
  }
  return sendJson(base, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, delivery: 'cookie' }),
  });
}

export async function authMe(base: string): Promise<unknown> {
  return sendJson(base, '/auth/me');
}

export async function rotateAuth(base: string): Promise<unknown> {
  return sendJson(base, '/auth/rotate', { method: 'POST' });
}

export async function logout(base: string): Promise<unknown> {
  return sendJson(base, '/auth/logout', { method: 'POST' });
}

export function setPlayerAuth(authHeader = ''): void {
  playerAuthHeader = authHeader.startsWith('Bearer ') ? authHeader : '';
}

export function getPlayerAuth(): string {
  return playerAuthHeader;
}

export async function sendAdmin(base: string, path: string, auth: AdminAuth = {}, init: RequestInit = {}): Promise<unknown> {
  return parseJsonResponse(await fetch(`${normalizeBase(base)}${path}`, {
    ...init,
    headers: adminHeaders(auth),
    credentials: 'include',
  }));
}

export function socketUrl(base: string, path = '/world/updates', _authHeader = ''): string {
  const normalized = normalizeBase(base);
  return `${normalized.replace(/^http/, 'ws')}${path}`;
}

export function mediaUrl(base: string, url: string): string {
  if (!url) return '';
  if (/^(https?:|data:)/.test(url)) return url;
  return `${normalizeBase(base)}${url}`;
}

export async function requestSceneImage(base: string, characterId: string, control: ControlClaimLike | null = null): Promise<unknown> {
  const params = new URLSearchParams();
  if (control?.claimId) params.set('claim_id', control.claimId);
  const query = params.toString();
  return sendJson(base, `/world/character/${encodeURIComponent(characterId)}/scene-image${query ? `?${query}` : ''}`, {
    method: 'POST',
    headers: claimHeaders(control),
  });
}
