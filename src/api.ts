export interface AdminAuth {
  authorization?: string;
  secret?: string;
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
  if (authHeader && authHeader.startsWith('Token ')) {
    return {
      'Content-Type': 'application/json',
      'X-Bunnyland-Admin-Secret': authHeader.slice(6),
    };
  }
  return {
    'Content-Type': 'application/json',
    ...(authHeader ? { Authorization: authHeader } : {}),
  };
}

export function adminHeaders(auth: AdminAuth = {}, contentType = ''): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (auth.secret) headers['X-Bunnyland-Admin-Secret'] = auth.secret;
  if (auth.authorization) headers.Authorization = auth.authorization;
  return headers;
}

export function claimHeaders(control: ControlClaimLike | null = null): Record<string, string> {
  return {
    ...jsonHeaders(playerAuthHeader),
    ...(control?.claimSecret ? { 'X-Bunnyland-Claim-Secret': control.claimSecret } : {}),
  };
}

export function mergePlayerHeaders(headers: HeadersInit = {}): Headers {
  const input = new Headers(headers);
  const merged = new Headers(jsonHeaders(playerAuthHeader));
  input.forEach((value, key) => merged.set(key, value));
  const explicitAuth = input.get('Authorization');
  if (playerAuthHeader && explicitAuth?.startsWith('Basic ') && explicitAuth !== playerAuthHeader) {
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
  return parseJsonResponse(await fetch(`${normalizeBase(base)}${path}`, { ...init, headers }));
}

export function setPlayerAuth(authHeader = ''): void {
  playerAuthHeader = authHeader;
}

export function getPlayerAuth(): string {
  return playerAuthHeader;
}

export async function sendAdmin(base: string, path: string, auth: AdminAuth = {}, init: RequestInit = {}): Promise<unknown> {
  return parseJsonResponse(await fetch(`${normalizeBase(base)}${path}`, {
    ...init,
    headers: adminHeaders(auth),
  }));
}

export function socketUrl(base: string, path = '/world/updates', authHeader = ''): string {
  const normalized = normalizeBase(base);
  if (!authHeader.startsWith('Basic ')) return `${normalized.replace(/^http/, 'ws')}${path}`;
  const url = new URL(`${normalized}${path}`, globalThis.location?.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const decoded = globalThis.atob(authHeader.slice(6));
  const separator = decoded.indexOf(':');
  if (separator >= 0) {
    url.username = decoded.slice(0, separator);
    url.password = decoded.slice(separator + 1);
  }
  return url.toString();
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
