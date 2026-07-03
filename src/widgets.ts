export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (_err) {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (_err) {
    // Preferences are best-effort; UI should keep working without storage.
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (_err) {
    // Best-effort storage cleanup only.
  }
}

export function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(tag => String(tag)).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(tag => tag.trim()).filter(Boolean);
  return [];
}
